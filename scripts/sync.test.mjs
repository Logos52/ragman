// @vitest-environment node
// scripts/sync.mjs against scratch repos: a bare "origin" and two clones, A and B, playing the two machines.
// Scratch root: RAGMAN_SYNC_TEST_DIR, else <os tmpdir>/ragman-sync-test. Never the real ragman-data.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFLICT_MESSAGE, createSync, syncFromEnv } from './sync.mjs';

const ROOT = process.env.RAGMAN_SYNC_TEST_DIR ?? join(tmpdir(), 'ragman-sync-test');
const quiet = () => {};
let n = 0;
let base = '';

const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (dir, rel, text) => { mkdirSync(join(dir, rel, '..'), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), 'utf8');
const count = (dir, ref = 'HEAD') => Number(git(dir, 'rev-list', '--count', ref));

function clone(name) {
  const dir = join(base, name);
  git(base, 'clone', '-q', join(base, 'origin.git'), dir);
  git(dir, 'config', 'user.name', 'sync test');
  git(dir, 'config', 'user.email', 'sync-test@example.invalid');
  git(dir, 'config', 'commit.gpgsign', 'false');
  return dir;
}

function machines() {
  git(base, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
  const seed = join(base, 'seed');
  mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'main');
  git(seed, 'config', 'user.name', 'sync test');
  git(seed, 'config', 'user.email', 'sync-test@example.invalid');
  git(seed, 'config', 'commit.gpgsign', 'false');
  write(seed, 'inventory.json', '{\n  "a": 1\n}\n');
  write(seed, 'other.txt', 'one\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'remote', 'add', 'origin', join(base, 'origin.git'));
  git(seed, 'push', '-q', '-u', 'origin', 'main');
  return { a: clone('a'), b: clone('b'), origin: join(base, 'origin.git') };
}

const syncAt = (dir, extra = {}) => createSync({ dir, log: quiet, host: 'test-host', ...extra });

beforeEach(() => {
  base = join(ROOT, `run-${process.pid}-${++n}`);
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
});
afterAll(() => { for (let i = 1; i <= n; i++) rmSync(join(ROOT, `run-${process.pid}-${i}`), { recursive: true, force: true }); });

describe('scripts/sync.mjs', () => {
  it('commits only when something changed, then pushes', async () => {
    const { a, origin } = machines();
    const s = syncAt(a);
    await s.start();
    expect(s.state().state).toBe('synced');
    expect(count(a)).toBe(1); // clean at startup: no commit

    write(a, 'inventory.json', '{\n  "a": 2\n}\n');
    const st = await s.syncNow();
    expect(st.state).toBe('synced');
    expect(st.ahead).toBe(0);
    expect(count(a)).toBe(2);
    expect(git(a, 'log', '-1', '--format=%s')).toMatch(/^Layout \d{4}-\d\d-\d\dT[\d:.]+Z from test-host$/);
    expect(count(origin, 'main')).toBe(2);

    await s.syncNow();
    expect(count(a)).toBe(2); // nothing new: no empty commit
  });

  it('schedule waits for the quiet period, then syncs once', async () => {
    const { a, origin } = machines();
    const s = syncAt(a, { delayMs: 40 });
    await s.start();
    write(a, 'inventory.json', '{\n  "a": 3\n}\n');
    s.schedule();
    s.schedule();
    expect(s.state().state).toBe('pending');
    for (let i = 0; i < 100 && s.state().state !== 'synced'; i++) await new Promise((r) => setTimeout(r, 25));
    expect(s.state().state).toBe('synced');
    expect(s.state().lastAt).toMatch(/Z$/);
    expect(count(origin, 'main')).toBe(2);
  });

  it('stages nothing when the tree is clean', async () => {
    const { a } = machines();
    const s = syncAt(a);
    await s.start();
    const head = git(a, 'rev-parse', 'HEAD');
    await s.syncNow();
    expect(git(a, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(a, 'diff', '--cached', '--name-only')).toBe('');
  });

  it('never stages a file whose name contains prices', async () => {
    const { a, origin } = machines();
    const s = syncAt(a);
    await s.start();
    write(a, 'x.prices.txt', 'secret\n');
    write(a, 'images/y.prices.txt', 'secret\n');
    write(a, 'Prices/z.txt', 'secret\n');
    write(a, 'inventory.json', '{\n  "a": 4\n}\n');
    await s.syncNow();
    expect(s.state().state).toBe('synced');
    const tracked = git(a, 'ls-files');
    expect(tracked).not.toMatch(/prices/i);
    expect(git(origin, 'ls-tree', '-r', '--name-only', 'main')).not.toMatch(/prices/i);
    expect(existsSync(join(a, 'x.prices.txt'))).toBe(true); // left alone on disk
    expect(git(a, 'log', '-1', '--name-only', '--format=')).toBe('inventory.json');
  });

  it('pulls a remote commit with rebase before pushing', async () => {
    const { a, b, origin } = machines();
    write(b, 'other.txt', 'two\n');
    git(b, 'commit', '-q', '-am', 'from b');
    git(b, 'push', '-q');

    const s = syncAt(a);
    write(a, 'inventory.json', '{\n  "a": 5\n}\n');
    await s.syncNow();
    expect(s.state().state).toBe('synced');
    expect(read(a, 'other.txt')).toBe('two\n');
    expect(count(origin, 'main')).toBe(3);
    expect(git(a, 'rev-list', '--merges', '--count', 'HEAD')).toBe('0'); // linear: rebased, not merged
  });

  it('startup commits, pulls once and pushes when ahead', async () => {
    const { a, b, origin } = machines();
    write(b, 'other.txt', 'from b\n');
    git(b, 'commit', '-q', '-am', 'from b');
    git(b, 'push', '-q');
    write(a, 'inventory.json', '{\n  "a": 6\n}\n'); // left uncommitted before the server started

    const s = syncFromEnv(a, {}, quiet);
    await s.ready;
    expect(s.state().state).toBe('synced');
    expect(read(a, 'other.txt')).toBe('from b\n');
    expect(count(origin, 'main')).toBe(3);
  });

  it('a conflicting remote change ends in error with the rebase aborted and the tree intact', async () => {
    const { a, b, origin } = machines();
    write(b, 'inventory.json', '{\n  "a": "b"\n}\n');
    git(b, 'commit', '-q', '-am', 'from b');
    git(b, 'push', '-q');

    const s = syncAt(a, { delayMs: 10 });
    await s.start(); // clean at startup: pulls b's change
    write(a, 'inventory.json', '{\n  "a": "a"\n}\n');
    write(b, 'inventory.json', '{\n  "a": "b2"\n}\n');
    git(b, 'commit', '-q', '-am', 'from b again');
    git(b, 'push', '-q');

    const st = await s.syncNow();
    expect(st.state).toBe('error');
    expect(st.message).toBe(CONFLICT_MESSAGE);
    expect(st.conflict).toBe(true);
    expect(st.ahead).toBe(1);
    expect(existsSync(join(a, '.git', 'rebase-merge'))).toBe(false);
    expect(existsSync(join(a, '.git', 'rebase-apply'))).toBe(false);
    expect(read(a, 'inventory.json')).toBe('{\n  "a": "a"\n}\n');
    expect(git(a, 'status', '--porcelain')).toBe('');
    expect(git(a, 'log', '-1', '--format=%s')).toMatch(/^Layout /); // the local commit stays
    expect(count(origin, 'main')).toBe(3); // nothing pushed

    // No automatic sync after a conflict.
    write(a, 'other.txt', 'later\n');
    s.schedule();
    await new Promise((r) => setTimeout(r, 60));
    expect(s.state().state).toBe('error');
    expect(git(a, 'status', '--porcelain')).toBe('M other.txt');
  });

  it('a failed push keeps the local commit and a retry pushes it', async () => {
    const { a, origin } = machines();
    const s = syncAt(a);
    await s.start();
    git(a, 'remote', 'set-url', 'origin', join(base, 'missing.git'));
    write(a, 'inventory.json', '{\n  "a": 7\n}\n');
    const st = await s.syncNow();
    expect(st.state).toBe('error');
    expect(st.message).toBeTruthy();
    expect(count(a)).toBe(2);

    git(a, 'remote', 'set-url', 'origin', origin);
    const again = await s.syncNow();
    expect(again.state).toBe('synced');
    expect(again.ahead).toBe(0);
    expect(count(origin, 'main')).toBe(2);
  });

  it('RAGMAN_SYNC=0 means off and nothing runs', async () => {
    const { a } = machines();
    const s = syncFromEnv(a, { RAGMAN_SYNC: '0' }, quiet);
    await s.ready;
    expect(s.state()).toMatchObject({ state: 'off', message: 'RAGMAN_SYNC=0' });
    write(a, 'inventory.json', '{\n  "a": 8\n}\n');
    s.schedule();
    await s.syncNow();
    expect(s.state().state).toBe('off');
    expect(count(a)).toBe(1);
  });

  it('off when the dir is not a git repo or has no upstream', async () => {
    const plain = join(base, 'plain');
    mkdirSync(plain);
    const p = syncAt(plain);
    await p.start();
    expect(p.state()).toMatchObject({ state: 'off', message: 'not a git repo' });

    const lone = join(base, 'lone');
    mkdirSync(lone);
    git(lone, 'init', '-q', '-b', 'main');
    const l = syncAt(lone);
    await l.start();
    expect(l.state()).toMatchObject({ state: 'off', message: 'no upstream branch' });
  });

  it('RAGMAN_SYNC_DELAY_MS sets the quiet period', () => {
    expect(syncFromEnv(base, { RAGMAN_SYNC: '0', RAGMAN_SYNC_DELAY_MS: '1500' }, quiet).delayMs).toBe(1500);
    expect(syncFromEnv(base, { RAGMAN_SYNC: '0' }, quiet).delayMs).toBe(20000);
  });
});
