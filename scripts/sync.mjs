// Background git sync of the ragman-data clone, shared by the Vite dev server (vite.config.ts) and
// scripts/serve.mjs. After a save it waits for a quiet period, then commits, pulls with rebase and pushes.
// Git runs through execFile with argument arrays, never a shell string. Nothing is ever force-pushed,
// reset or checked out. Files whose name contains "prices" are never staged.
//
//   const sync = syncFromEnv(dataDir);   // reads RAGMAN_SYNC, RAGMAN_SYNC_DELAY_MS
//   await sync.ready;                    // startup sync done (or skipped)
//   sync.schedule();                     // after every successful PUT
//   handleSyncRoute(sync, req, res);     // GET /data/sync (state), POST /data/sync (sync now)
import { execFile } from 'node:child_process';
import { existsSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';

export const DEFAULT_DELAY_MS = 20000;
export const CONFLICT_MESSAGE = 'conflict: pull by hand';
const GIT_TIMEOUT_MS = 60000;
// Stage everything under the data dir except any path containing "prices" (a pathspec "*" also matches "/",
// so this covers every folder; icase so "Prices" is caught too) and the .claude folder (agent worktrees
// live there; staging one would add a nested repository).
const ADD_ARGS = ['add', '-A', '--', '.', ':(exclude,icase)*prices*', ':(exclude).claude'];

class GitError extends Error {
  constructor(args, err, stderr) {
    super(clean(stderr) || clean(err?.message) || `git ${args[0]} failed`);
    this.args = args;
  }
}

function clean(s) {
  if (!s) return '';
  const lines = String(s).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('hint:'));
  return lines.join(' ').slice(0, 300);
}

function git(dir, args, raw = false) {
  return new Promise((resolve, reject) => {
    execFile('git', args, {
      cwd: dir,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'buffer',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true', LC_ALL: 'C' },
    }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(new GitError(args, err, String(stderr)), { code: err.code }));
      else resolve(raw ? stdout : String(stdout).trim());
    });
  });
}

/** The commit refs/stash points at, or '' when there is no stash. */
async function stashTop(dir) {
  try { return await git(dir, ['rev-parse', '-q', '--verify', 'refs/stash']); } catch { return ''; }
}

/**
 * `git pull --rebase --autostash` exits 0 even when the stashed changes (a save that landed after
 * `git add`) conflict with the pulled commits; the file is left with conflict markers. Put back the
 * stashed version of each conflicted file (it is what the page holds in memory), mark it resolved,
 * and drop the autostash. Returns the paths that were in conflict ([] when there were none).
 */
async function undoAutostashConflict(dir, stashBefore) {
  const unmerged = await git(dir, ['diff', '--name-only', '--diff-filter=U', '-z']);
  const paths = [...new Set(unmerged.split('\0').filter(Boolean))];
  if (!paths.length) return [];
  const top = await stashTop(dir);
  if (!top || top === stashBefore) throw Object.assign(new Error(`unmerged files after pull: ${paths.join(', ')}`), { conflict: true });
  for (const p of paths) {
    try { writeFileSync(join(dir, p), await git(dir, ['show', `${top}:${p}`], true)); } catch { /* not in the stash: leave the file */ }
  }
  await git(dir, ['add', '-A', '--', ...paths]);
  await git(dir, ['stash', 'drop', '-q']);
  return paths;
}

/** Why sync cannot run in `dir` (a string), or null when it can. */
async function whyOff(dir) {
  let top;
  try { top = await git(dir, ['rev-parse', '--show-toplevel']); } catch { return 'not a git repo'; }
  if (realpathSync(top) !== realpathSync(dir)) return `not the top of a git repo (top is ${top})`;
  try { await git(dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']); } catch { return 'no upstream branch'; }
  return null;
}

async function rebaseInProgress(dir) {
  for (const p of ['rebase-merge', 'rebase-apply']) {
    try { if (existsSync(await git(dir, ['rev-parse', '--path-format=absolute', '--git-path', p]))) return true; } catch { /* ignore */ }
  }
  return false;
}

/**
 * @param {{ dir: string, enabled?: boolean, offReason?: string, delayMs?: number, log?: (line: string) => void,
 *           now?: () => Date, host?: string }} opts
 */
export function createSync(opts) {
  const dir = opts.dir;
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const log = opts.log ?? ((line) => console.log(line));
  const now = opts.now ?? (() => new Date());
  const host = opts.host ?? hostname();

  let enabled = opts.enabled !== false;
  let conflict = false;    // set by a rebase conflict; blocks automatic syncs until a later sync ends without one
  let timer = null;
  let running = null;      // the sync in flight
  let again = false;       // a save landed while a sync was running
  const st = { state: enabled ? 'idle' : 'off', lastAt: null, message: opts.offReason ?? null, ahead: 0 };

  const set = (patch) => { Object.assign(st, patch); };

  async function ahead() {
    try { return Number(await git(dir, ['rev-list', '--count', '@{u}..HEAD'])) || 0; } catch { return st.ahead; }
  }

  async function markConflict(detail) {
    conflict = true;
    set({ state: 'error', message: CONFLICT_MESSAGE, ahead: await ahead() });
    log(`ragman sync: ${CONFLICT_MESSAGE} (${detail})`);
  }

  /** One pass. `always`: pull and push even when nothing new was committed (startup, manual retry). */
  async function pass(always) {
    set({ state: 'syncing' });
    try {
      await git(dir, ADD_ARGS);
      let staged = false;
      try { await git(dir, ['diff', '--cached', '--quiet']); } catch (e) { if (e.code === 1) staged = true; else throw e; }
      if (staged) await git(dir, ['commit', '-q', '-m', `Layout ${now().toISOString()} from ${host}`]);
      if (!staged && !always && (await ahead()) === 0) {
        set({ state: st.lastAt ? 'synced' : 'idle', message: null, ahead: 0 });
        return;
      }
      const stashBefore = await stashTop(dir);
      try {
        await git(dir, ['pull', '-q', '--rebase', '--autostash']);
        const clashed = await undoAutostashConflict(dir, stashBefore);
        // A save landed during the sync and clashes with the pulled commits: same as a rebase conflict.
        if (clashed.length) return await markConflict(`the last save clashes with pulled changes in ${clashed.join(', ')}; the file holds the last save`);
      } catch (e) {
        if (e.conflict) return await markConflict(e.message);
        if (await rebaseInProgress(dir)) {
          try { await git(dir, ['rebase', '--abort']); } catch { /* leave it; the message says pull by hand */ }
          return await markConflict(e.message);
        }
        throw e;
      }
      if ((await ahead()) > 0) await git(dir, ['push', '-q']);
      conflict = false;
      set({ state: 'synced', lastAt: now().toISOString(), message: null, ahead: await ahead() });
    } catch (e) {
      conflict = false; // the last outcome was not a conflict: the next save tries again
      set({ state: 'error', message: e instanceof Error ? e.message : String(e), ahead: await ahead() });
      log(`ragman sync: ${st.message}`);
    }
  }

  function run(always) {
    if (running) { again = true; return running; }
    running = (async () => {
      let first = true;
      do {
        again = false;
        await pass(always && first);
        first = false;
      } while (again && !conflict && enabled);
    })().finally(() => {
      running = null;
      if (timer) set({ state: 'pending' }); // a save landed during the pass; its sync is still waiting
    });
    return running;
  }

  const api = {
    /** Resolves once the startup sync has finished or was skipped. Never rejects. */
    ready: Promise.resolve(),
    get dir() { return dir; },
    get delayMs() { return delayMs; },
    state() { return { ...st, conflict }; },

    /** Startup: check the repo, then commit, pull once and push if ahead. Serve anyway when it fails. */
    async start() {
      if (!enabled) { log(`ragman sync: off (${st.message ?? 'disabled'})`); return; }
      const why = await whyOff(dir);
      if (why) {
        enabled = false;
        set({ state: 'off', message: why });
        log(`ragman sync: off (${why}): ${dir}`);
        return;
      }
      log(`ragman sync: on, ${delayMs} ms after the last save: ${dir}`);
      await run(true);
    },

    /** A save happened: (re)start the quiet period. Ignored when off or after a conflict. */
    schedule() {
      if (!enabled || conflict) return;
      if (timer) clearTimeout(timer);
      if (!running) set({ state: 'pending' });
      timer = setTimeout(() => { timer = null; void run(false); }, delayMs);
      timer.unref?.();
    },

    /** Sync now (the manual retry). Also clears a conflict when it succeeds. Resolves with the state. */
    async syncNow() {
      if (!enabled) return api.state();
      if (timer) { clearTimeout(timer); timer = null; }
      if (running) await running;
      await run(true);
      return api.state();
    },

    /** Stop the timer (tests, shutdown). */
    stop() { if (timer) clearTimeout(timer); timer = null; },
  };
  return api;
}

/**
 * Build and start the sync for a data dir from the environment.
 * RAGMAN_SYNC=0 turns it off; RAGMAN_SYNC_DELAY_MS sets the quiet period. Off under vitest, which loads
 * vite.config.ts too, so a test run never touches the data repo.
 */
export function syncFromEnv(dir, env = process.env, log) {
  const raw = env.RAGMAN_SYNC_DELAY_MS?.trim();
  const delay = raw ? Number(raw) : NaN;
  const offReason = env.RAGMAN_SYNC === '0' ? 'RAGMAN_SYNC=0' : env.VITEST ? 'test run' : null;
  const sync = createSync({
    dir, log, enabled: !offReason, offReason: offReason ?? undefined,
    delayMs: Number.isFinite(delay) && delay >= 0 ? delay : DEFAULT_DELAY_MS,
  });
  sync.ready = sync.start().catch((e) => { (log ?? console.log)(`ragman sync: startup failed: ${e}`); });
  return sync;
}

/** JSON reply with the sync state. */
export function sendSyncState(res, state, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(state));
}

/** GET /data/sync returns the state; POST /data/sync syncs now and returns the state after it. */
export function handleSyncRoute(sync, req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') { sendSyncState(res, sync.state()); return; }
  if (req.method === 'POST') {
    req.resume(); // ignore any body
    sync.syncNow().then((s) => sendSyncState(res, s), (e) => { res.statusCode = 500; res.end(String(e)); });
    return;
  }
  res.statusCode = 405; res.setHeader('Allow', 'GET, POST'); res.end('method not allowed');
}

/** After a successful PUT: schedule a sync and reply (inventory.json carries the state, images get 204). */
export function afterPut(sync, res, rel) {
  sync.schedule();
  if (rel === 'inventory.json') sendSyncState(res, sync.state());
  else { res.statusCode = 204; res.end(); }
}
