#!/usr/bin/env node
/**
 * Acceptance proof (PRD brief section 12): screenshots of every view in every state, desktop 1440x900 and
 * phone 390x844, into refs/proof/, plus refs/proof/perf.json from window.__ragmanPerf.
 *
 *   node scripts/shots.mjs            (npm run shots)
 *
 * Starts its own Vite dev server on port 5370 (stopped on exit). Every PUT to /data/* is aborted, so the
 * real ragman-data/inventory.json and images are never written. Shots that change data first re-adopt the
 * loaded file as an in-memory source (adoptInventory with { kind: 'bundled' }), so no save is attempted
 * at all; the PUT abort stays as the backstop. The failed-save shots (archive-error, window-error, inspect-error)
 * mutate on the server source on purpose: their PUT is aborted, which is exactly the error state they show. Playwright is loaded from the portable install at
 * C:\Users\nxlog\tools\pw (override with PW_DIR).
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const PW_DIR = process.env.PW_DIR ?? 'C:/Users/nxlog/tools/pw';
const { chromium } = require(join(PW_DIR, 'node_modules', 'playwright'));

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'refs', 'proof');
const PORT = Number(process.env.SHOTS_PORT ?? 5370); // override when 5370 is taken
const BASE = `http://localhost:${PORT}/`;
const VIEWPORTS = [
  { tag: 'desktop', width: 1440, height: 900 },
  { tag: 'phone', width: 390, height: 844 },
];
const only = process.argv.slice(2); // optional shot names to run

mkdirSync(OUT, { recursive: true });

/* ---------------- dev server ---------------- */

let vite = null;
function stopVite() { if (vite && vite.exitCode == null) { try { vite.kill(); } catch { /* gone */ } } }
process.on('exit', stopVite);
process.on('SIGINT', () => { stopVite(); process.exit(130); });

async function startVite() {
  vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BROWSER: 'none' },
  });
  let log = '';
  vite.stdout.on('data', (d) => { log += d; });
  vite.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 120; i++) {
    if (vite.exitCode != null) throw new Error(`vite exited:\n${log}`);
    try { const r = await fetch(BASE); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`vite did not start on ${PORT}:\n${log}`);
}

/* ---------------- page helpers ---------------- */

const DEMO = readFileSync(join(root, 'data', 'demo', 'inventory.json'), 'utf8');
const isInv = (u) => /\/data\/inventory\.json(\?|$)/.test(u);
const pageErrors = [];

/**
 * A fresh context per shot (fresh localStorage, so windows open at the cascade).
 * opts.inventory(route) answers GET /data/inventory.json; opts.ready is the selector to wait for.
 */
async function open(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${vp.tag}: ${String(e)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|404/.test(m.text())) pageErrors.push(`${vp.tag}: ${m.text()}`); });
  await page.route('**/data/**', async (r) => {
    const req = r.request();
    if (req.method() === 'PUT') return r.abort(); // never write the real data
    if (opts.inventory && isInv(req.url())) return opts.inventory(r);
    return r.continue();
  });
  await page.goto(BASE, { waitUntil: opts.waitUntil ?? 'load' });
  if (opts.ready !== null) {
    await page.waitForSelector(opts.ready ?? '.gear', { timeout: 20000 });
    await settle(page);
  }
  return { ctx, page };
}

/** Fonts and every <img> settled, then two frames. */
async function settle(page, extra = 150) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(extra);
}

/** Re-adopt the loaded file as an in-memory source (no saver), optionally editing a copy first. */
async function inMemory(page, edit = null, arg = null) {
  await page.evaluate(async ({ edit, arg }) => {
    const m = await import('/src/model/store.ts');
    if (m.getStore !== window.__ragmanStore) throw new Error('store module mismatch');
    const inv = structuredClone(m.getStore().inv);
    if (edit) (0, eval)(`(${edit})`)(inv, arg);
    m.adoptInventory(inv, { kind: 'bundled' });
  }, { edit: edit ? edit.toString() : null, arg });
  await settle(page);
}

const store = (page, fn, arg) => page.evaluate(({ fn, arg }) => (0, eval)(`(${fn})`)(window.__ragmanStore(), arg), { fn: fn.toString(), arg });

/** Scroll a tile into view and return its centre in viewport px. */
async function tileCenter(page, id, scope = '') {
  const sel = `${scope} [data-tile="${id}"]`.trim();
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no tile ${id}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** tileCenter() may have scrolled the middle column to reach a half-visible tile; put it back at the top. */
async function carriedTop(page) {
  await page.evaluate(() => { const c = document.querySelector('.gear-carried'); if (c) c.scrollTop = 0; });
}

/**
 * Park the mouse on a neutral spot before a capture: the bottom-left corner, in the 12 px page gutter (and the
 * windows' 16 px gutter), so no tile, tab or button keeps a hover border. Shots whose subject is the pointer (a
 * tooltip, a drag, a hovered submenu) pass keepPointer.
 */
async function neutralPointer(page) {
  const { height } = page.viewportSize();
  await page.mouse.move(2, height - 2);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function shot(page, name, vp, opts = {}) {
  if (!opts.keepPointer) await neutralPointer(page);
  await page.screenshot({ path: join(OUT, `${name}-${vp.tag}.png`), fullPage: !!opts.fullPage });
}

/** Stash geometry: the grid's rect, px per cell, the view, and a free-cell finder. */
async function stashInfo(page) {
  // the grid's top at the top of the viewport (phone: the page scrolls; desktop: a no-op)
  await page.evaluate(() => document.querySelector('.gear-stash .rg-grid').scrollIntoView({ block: 'start' }));
  return page.evaluate(() => {
    const st = window.__ragmanStore();
    const g = document.querySelector('.gear-stash .rg-grid');
    const sc = document.querySelector('.gear-stash__scroll');
    const r = g.getBoundingClientRect();
    const s = sc.getBoundingClientRect();
    const view = st.gridView(st.showArchive ? { kind: 'archive' } : { kind: 'stash', location: st.stashLocation });
    const cell = (r.width - 1) / view.width;
    return { left: r.left, top: r.top, cell, view, visTop: Math.max(s.top, 0), visBottom: Math.min(s.bottom, innerHeight) };
  });
}
function occupancy(view) {
  const occ = new Map();
  for (const it of view.items) for (let x = it.x; x < it.x + it.w; x++) for (let y = it.y; y < it.y + it.h; y++) occ.set(`${x},${y}`, it.id);
  return occ;
}
/** Free 1x1 cells whose centre is on screen. */
function freeCells(info) {
  const occ = occupancy(info.view);
  const out = [];
  for (let y = 0; y < info.view.height; y++) for (let x = 0; x < info.view.width; x++) {
    const cy = info.top + (y + 0.5) * info.cell;
    if (cy < info.visTop + 4 || cy > info.visBottom - 4) continue;
    if (!occ.has(`${x},${y}`)) out.push({ x, y });
  }
  return out;
}
const onScreen = (info, it) => { const c = cellPx(info, it.x, it.y); return c.y > info.visTop + 4 && c.y < info.visBottom - 4; };
const cellPx = (info, x, y) => ({ x: info.left + (x + 0.5) * info.cell, y: info.top + (y + 0.5) * info.cell });

/** Press on a point, move in steps to another, leaving the button down. */
async function dragTo(page, a, b, steps = 10) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
  await page.waitForTimeout(60);
}

async function menuRow(page, label) {
  await page.locator('.rg-cmenu [role="menuitem"]', { has: page.locator('.rg-cmenu__label', { hasText: new RegExp(`^${label}$`) }) }).first().click();
}

const tab = (page, name) => page.locator('.rg-tabbar [role="tab"]', { hasText: new RegExp(`^${name}$`, 'i') }).click();

/** GET /data/inventory.json answers 404: the load error banner. */
const notFound = (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 404, body: 'not found' }) : r.continue());

/**
 * A failed save, the only error a loaded view shows (DESIGN, States: "failed save shows the footer badge only").
 * Runs a mutation on the server source; its PUT is aborted by the route in open(), so nothing is written, and the
 * footer badge turns NOT SAVED · RETRY.
 */
async function saveFails(page, fn, arg) {
  await store(page, fn, arg);
  await page.waitForSelector('.rg-save--error', { timeout: 5000 });
  await settle(page);
}

/**
 * Phone: the footer (and its NOT SAVED · RETRY badge) sits under the stacked columns, below the 844 px frame.
 * Scroll the page to the end so it is in frame; the windows are position: fixed, so they stay where they are.
 */
async function footerInView(page, vp) {
  if (vp.tag !== 'phone') return;
  await page.evaluate(() => document.querySelector('.gear-footer').scrollIntoView({ block: 'end' }));
  await settle(page, 50);
}

/** The loading state: the inventory GET is held until the shot is taken (optionally on another tab). */
async function heldLoad(b, vp, name, check, tabName) {
  let release;
  const held = new Promise((r) => { release = r; });
  const { ctx, page } = await open(b, vp, {
    inventory: async (r) => { await held; return r.continue(); },
    waitUntil: 'domcontentloaded',
    ready: null,
  });
  try {
    await page.waitForSelector('.rg-app', { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    if (tabName) await tab(page, tabName);
    await page.waitForTimeout(100);
    if (await store(page, (s) => !!s.inv)) throw new Error(`${name}: inventory already loaded`);
    if (check) await check(page);
    await shot(page, name, vp);
  } finally {
    release();
    await ctx.close();
  }
}

/* ---------------- the shots ---------------- */

const FILSON = 'filson-journeyman';
const DRIFT = 'mw-drift';
const DRAWERS = 'ikea-alex-drawer-unit-white';
const MACBOOK = 'macbook-pro-14';

const SHOTS = {
  async 'gear-plane'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await store(page, (s) => { if (s.inv.activeLoadout !== 'Plane') throw new Error('Plane is not the active loadout on load'); });
    await shot(page, 'gear-plane', vp, { fullPage: vp.tag === 'phone' });
    await ctx.close();
  },
  async 'gear-work'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    await page.locator('.gear-person [role="radio"]', { hasText: /^Work$/ }).click();
    await settle(page);
    await shot(page, 'gear-work', vp, { fullPage: vp.tag === 'phone' });
    await ctx.close();
  },
  async archive(b, vp) {
    const { ctx, page } = await open(b, vp);
    await page.locator('.gear-stash__head button', { hasText: /^Archive$/ }).click();
    await settle(page);
    await page.locator('.gear-stash').scrollIntoViewIfNeeded();
    await shot(page, 'archive', vp);
    await ctx.close();
  },
  async 'filter-strip-active'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await page.locator('.gear-filter button[aria-label="tops"]').click();
    await settle(page);
    await page.locator('.gear-stash').scrollIntoViewIfNeeded();
    await shot(page, 'filter-strip-active', vp);
    await ctx.close();
  },
  async search(b, vp) {
    const { ctx, page } = await open(b, vp);
    await page.locator('.gear-stash__search input').fill('linen');
    await settle(page);
    await page.locator('.gear-stash').scrollIntoViewIfNeeded();
    await shot(page, 'search', vp);
    await ctx.close();
  },
  async 'window-filson'(b, vp) {
    const { ctx, page } = await open(b, vp);
    const c = await tileCenter(page, FILSON, '.gear-carried');
    await page.mouse.dblclick(c.x, c.y);
    await page.waitForSelector('.gear-win');
    await settle(page);
    await page.locator('.gear-win').first().scrollIntoViewIfNeeded();
    await shot(page, 'window-filson', vp);
    await ctx.close();
  },
  async 'window-drift'(b, vp) {
    const { ctx, page } = await open(b, vp);
    const c = await tileCenter(page, DRIFT, '.gear-carried');
    await page.mouse.dblclick(c.x, c.y);
    await page.waitForSelector('.gear-win');
    await settle(page);
    await page.locator('.gear-win').first().scrollIntoViewIfNeeded();
    await carriedTop(page);
    await shot(page, 'window-drift', vp);
    await ctx.close();
  },
  async 'window-drawers'(b, vp) {
    const { ctx, page } = await open(b, vp);
    // the drawer unit sits deep in the USA stash; open it the way a double-click does
    await store(page, (s, id) => s.openWindow(id), DRAWERS);
    await page.waitForSelector('.gear-win');
    await settle(page);
    await page.locator('.gear-win').first().scrollIntoViewIfNeeded();
    await shot(page, 'window-drawers', vp);
    await ctx.close();
  },
  async 'inspect-item'(b, vp) {
    const { ctx, page } = await open(b, vp);
    const c = await tileCenter(page, MACBOOK, '.gear-carried');
    await page.mouse.dblclick(c.x, c.y);
    await page.waitForSelector('.rg-insp-win');
    await settle(page, 400);
    await page.locator('.rg-insp-win').first().scrollIntoViewIfNeeded();
    await shot(page, 'inspect-item', vp);
    await ctx.close();
  },
  async 'inspect-container'(b, vp) {
    const { ctx, page } = await open(b, vp);
    const c = await tileCenter(page, FILSON, '.gear-carried');
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await menuRow(page, 'Inspect');
    await page.waitForSelector('.rg-insp-win');
    await settle(page, 400);
    await page.locator('.rg-insp-win').first().scrollIntoViewIfNeeded();
    await shot(page, 'inspect-container', vp);
    await ctx.close();
  },
  async edit(b, vp) {
    const { ctx, page } = await open(b, vp);
    const c = await tileCenter(page, MACBOOK, '.gear-carried');
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await menuRow(page, 'Edit');
    await page.waitForSelector('.rg-modal__card');
    await settle(page, 300);
    await shot(page, 'edit', vp);
    await ctx.close();
  },
  async add(b, vp) {
    const { ctx, page } = await open(b, vp);
    await page.locator('.gear-stash__head button', { hasText: /^Add$/ }).click();
    await page.waitForSelector('.rg-modal__card');
    await settle(page, 300);
    await shot(page, 'add', vp);
    await ctx.close();
  },
  async 'context-menu'(b, vp) {
    const { ctx, page } = await open(b, vp);
    const c = await tileCenter(page, FILSON, '.gear-carried');
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await page.waitForSelector('.rg-cmenu');
    await settle(page);
    await shot(page, 'context-menu', vp);
    await ctx.close();
  },
  async tooltip(b, vp) {
    const { ctx, page } = await open(b, vp);
    const c = await tileCenter(page, MACBOOK, '.gear-carried');
    await page.mouse.move(c.x - 20, c.y - 20);
    await page.mouse.move(c.x, c.y, { steps: 3 });
    await page.waitForSelector('.rg-tooltip', { timeout: 3000 });
    await settle(page);
    await shot(page, 'tooltip', vp, { keepPointer: true });
    await ctx.close();
  },
  async 'drag-valid'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    const info = await stashInfo(page);
    const occ = occupancy(info.view);
    const src = info.view.items.find((it) => it.w === 1 && it.h === 1 && onScreen(info, it));
    // the free cell nearest the middle of the visible stash (below the 40 px sticky tab bar), so the lit cells are
    // fully in view rather than flush under the bar
    const midY = (Math.max(info.visTop, 40) + info.visBottom) / 2;
    const free = freeCells(info).filter((f) => f.x !== src.x || f.y !== src.y)
      .sort((a, b) => Math.abs(cellPx(info, a.x, a.y).y - midY) - Math.abs(cellPx(info, b.x, b.y).y - midY))[0];
    if (!src || !free || occ.has(`${free.x},${free.y}`)) throw new Error('no free cell for drag-valid');
    await dragTo(page, cellPx(info, src.x, src.y), cellPx(info, free.x, free.y));
    const ok = await page.locator('.rg-grid__hl--ok').count();
    if (!ok) throw new Error('drag-valid: no green highlight');
    await shot(page, 'drag-valid', vp, { keepPointer: true });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await ctx.close();
  },
  async 'drag-invalid'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    const info = await stashInfo(page);
    const vis = info.view.items.filter((it) => cellPx(info, it.x, it.y).y > info.visTop && cellPx(info, it.x, it.y).y < info.visBottom - info.cell);
    const src = vis.find((it) => it.w === 1 && it.h === 1);
    const onto = vis.find((it) => it.id !== src.id && it.w >= 2);
    await dragTo(page, cellPx(info, src.x, src.y), cellPx(info, onto.x, onto.y + 1));
    const bad = await page.locator('.rg-grid__hl--bad').count();
    if (!bad) throw new Error('drag-invalid: no red highlight');
    await shot(page, 'drag-invalid', vp, { keepPointer: true });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await ctx.close();
  },
  async 'over-limit'(b, vp) {
    const { ctx, page } = await open(b, vp);
    const w = await store(page, (s, id) => s.weightOf(id), FILSON);
    // A limit below what the bag holds now. When nothing in the bag is weighed yet (grams 0) no limit can be
    // exceeded, so the in-memory copy (never saved) also gets a test weight on the bag itself.
    const testWeight = w.grams > 0 ? null : 1000;
    const limit = Math.max(1, Math.floor((w.grams || testWeight) / 2));
    // Typed into the Filson's Edit form, as Wedge would, on an in-memory copy (never saved).
    await inMemory(page);
    const c = await tileCenter(page, FILSON, '.gear-carried');
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await menuRow(page, 'Edit');
    await page.waitForSelector('input[aria-label="Weight limit (g)"]');
    if (testWeight != null) await page.locator('.rg-form__f', { hasText: /^Weight \(g\)/ }).locator('input').fill(String(testWeight));
    await page.locator('input[aria-label="Weight limit (g)"]').fill(String(limit));
    await page.locator('.rg-modal__card button[type="submit"]').click();
    await settle(page);
    const after = await store(page, (s, id) => s.weightOf(id), FILSON);
    if (!after.overLimit) throw new Error(`over-limit: Filson not over (${JSON.stringify(after)})`);
    await page.locator('.gear-bag').first().scrollIntoViewIfNeeded();
    await shot(page, 'over-limit', vp);
    await ctx.close();
  },
  async tasks(b, vp) {
    const { ctx, page } = await open(b, vp);
    await tab(page, 'Tasks');
    await page.waitForSelector('.rg-tasks');
    await settle(page);
    await shot(page, 'tasks', vp, { fullPage: vp.tag === 'phone' });
    await ctx.close();
  },
  async 'tasks-empty'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page, (inv) => { inv.tasks = []; });
    await tab(page, 'Tasks');
    await page.waitForSelector('.rg-tasks');
    await settle(page);
    await shot(page, 'tasks-empty', vp);
    await ctx.close();
  },
  async overall(b, vp) {
    const { ctx, page } = await open(b, vp);
    await tab(page, 'Overall');
    await settle(page);
    await shot(page, 'overall', vp);
    await ctx.close();
  },
  async skills(b, vp) {
    const { ctx, page } = await open(b, vp);
    await tab(page, 'Skills');
    await settle(page);
    await shot(page, 'skills', vp);
    await ctx.close();
  },
  async 'error-banner'(b, vp) {
    const { ctx, page } = await open(b, vp, {
      inventory: (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 404, body: 'not found' }) : r.continue()),
      ready: '.rg-banner',
    });
    await shot(page, 'error-banner', vp);
    await ctx.close();
  },
  async empty(b, vp) {
    const { ctx, page } = await open(b, vp, {
      inventory: (r) => (r.request().method() === 'GET'
        ? r.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: DEMO })
        : r.continue()),
    });
    await shot(page, 'empty', vp, { fullPage: vp.tag === 'phone' });
    await ctx.close();
  },
  async loading(b, vp) {
    let release;
    const held = new Promise((r) => { release = r; });
    const { ctx, page } = await open(b, vp, {
      inventory: async (r) => { await held; return r.continue(); },
      waitUntil: 'domcontentloaded',
      ready: null,
    });
    await page.waitForSelector('.rg-app', { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    const loaded = await store(page, (s) => !!s.inv);
    if (loaded) throw new Error('loading: inventory already loaded');
    await shot(page, 'loading', vp);
    release();
    await ctx.close();
  },
  async 'pinned-locked-unverified-stack'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    const ids = await store(page, (s) => {
      const v = s.gridView({ kind: 'stash', location: s.stashLocation });
      // the first four tiles of the stash, reading order (Not Worn items live in the Archive, not here)
      const top = [...v.items].sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 4).map((it) => it.id);
      const [pin, lock, ver, stack] = top;
      s.setPinned(pin, true);
      s.setLocked(lock, true);
      s.setVerified(ver, true);
      s.updateItem(stack, { consumable: true });
      s.updateItem(stack, { quantity: 3 });
      const it = (id) => { const x = s.getItem(id); return { id, pinned: !!x.pinned, locked: !!x.locked, verified: !!x.verified, quantity: x.quantity ?? null }; };
      return [it(pin), it(lock), it(ver), it(stack)];
    });
    if (!ids[0].pinned || !ids[1].locked || !ids[2].verified || ids[3].quantity !== 3) throw new Error(`marks not set: ${JSON.stringify(ids)}`);
    await settle(page);
    await page.evaluate(() => document.querySelector('.gear-stash').scrollIntoView({ block: 'start' }));
    await shot(page, 'pinned-locked-unverified-stack', vp);
    await ctx.close();
  },

  /* ---- states of the views beyond the Gear tab ---- */
  async 'archive-empty'(b, vp) {
    const { ctx, page } = await open(b, vp);
    // an in-memory copy with nothing archived (the Archive holds items whose home is in it)
    await inMemory(page, (inv) => { for (const [id, it] of Object.entries(inv.items)) if (it.home?.kind === 'archive') delete inv.items[id]; });
    await page.locator('.gear-stash__head button', { hasText: /^Archive$/ }).click();
    await settle(page);
    const n = await store(page, (s) => s.gridView({ kind: 'archive' }).items.length);
    if (n) throw new Error(`archive-empty: ${n} items`);
    await page.locator('.gear-stash').scrollIntoViewIfNeeded();
    await shot(page, 'archive-empty', vp);
    await ctx.close();
  },
  async 'archive-error'(b, vp) {
    // After load, the only error a view shows is a failed save (DESIGN, States): archive an item while every PUT is
    // aborted (the real file is never written), so the footer badge reads NOT SAVED · RETRY with the Archive on screen.
    const { ctx, page } = await open(b, vp);
    await page.locator('.gear-stash__head button', { hasText: /^Archive$/ }).click();
    await settle(page);
    await saveFails(page, (s) => { const id = s.gridView({ kind: 'stash', location: s.stashLocation }).items[0].id; s.archive(id); });
    // phone: the whole page, so the lit Archive toggle and the footer badge are both in frame (scrolled to the top
    // first, so the sticky tab bar is drawn at the top of the capture and not across the middle)
    if (vp.tag === 'phone') await page.evaluate(() => window.scrollTo(0, 0));
    else await page.locator('.gear-stash').scrollIntoViewIfNeeded();
    await shot(page, 'archive-error', vp, { fullPage: vp.tag === 'phone' });
    await ctx.close();
  },
  async 'loading-archive-disabled'(b, vp) {
    // The Archive cannot be shown before the file loads (showArchive starts false and the toggle is disabled until the
    // inventory arrives), so there is no Archive loading view: this is the loading skeleton with the Archive toggle
    // drawn but disabled.
    await heldLoad(b, vp, 'loading-archive-disabled', async (page) => {
      if (!(await page.locator('.gear-stash__head button[disabled]', { hasText: /^Archive$/ }).count())) throw new Error('no disabled Archive toggle');
      // phone: the stash header (with the disabled toggle) sits under the doll and the carried column; bring it in frame
      await page.locator('.gear-stash__head').scrollIntoViewIfNeeded();
    });
  },
  async 'window-error'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await store(page, (s, id) => s.openWindow(id), FILSON);
    await page.waitForSelector('.gear-win');
    await saveFails(page, (s, id) => s.sendToStash(id), MACBOOK);
    await footerInView(page, vp);
    await shot(page, 'window-error', vp);
    await ctx.close();
  },
  async 'inspect-error'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await page.evaluate((id) => window.__ragmanUi.getState().inspect(id), MACBOOK);
    await page.waitForSelector('.rg-insp-win');
    await saveFails(page, (s, id) => s.setVerified(id, !s.getItem(id).verified), MACBOOK);
    await footerInView(page, vp);
    await shot(page, 'inspect-error', vp);
    await ctx.close();
  },
  async 'tasks-loading'(b, vp) {
    await heldLoad(b, vp, 'tasks-loading', null, 'Tasks');
  },
  async 'tasks-error'(b, vp) {
    const { ctx, page } = await open(b, vp, { inventory: notFound, ready: '.rg-banner' });
    await tab(page, 'Tasks');
    await page.waitForSelector('.rg-tasks');
    await settle(page);
    await shot(page, 'tasks-error', vp);
    await ctx.close();
  },
  async 'overall-loading'(b, vp) { await heldLoad(b, vp, 'overall-loading', null, 'Overall'); },
  async 'overall-error'(b, vp) {
    const { ctx, page } = await open(b, vp, { inventory: notFound, ready: '.rg-banner' });
    await tab(page, 'Overall');
    await settle(page);
    await shot(page, 'overall-error', vp);
    await ctx.close();
  },
  async 'skills-loading'(b, vp) { await heldLoad(b, vp, 'skills-loading', null, 'Skills'); },
  async 'skills-error'(b, vp) {
    const { ctx, page } = await open(b, vp, { inventory: notFound, ready: '.rg-banner' });
    await tab(page, 'Skills');
    await settle(page);
    await shot(page, 'skills-error', vp);
    await ctx.close();
  },
  async 'tasks-chain'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page, (inv) => {
      if (inv.tasks.length < 2) throw new Error('tasks-chain needs two tasks');
      inv.tasks[0].unlocks = [inv.tasks[1].id];
      inv.tasks[1].status = 'locked';
    });
    await tab(page, 'Tasks');
    await page.waitForSelector('.rg-tasks__chain');
    await settle(page);
    await shot(page, 'tasks-chain', vp, { fullPage: vp.tag === 'phone' });
    await ctx.close();
  },

  /* ---- EFT features ---- */
  async 'filter-by-item'(b, vp) {
    const { ctx, page } = await open(b, vp);
    const id = await store(page, (s) => {
      const v = s.gridView({ kind: 'stash', location: s.stashLocation });
      return (v.items.find((it) => /linen/i.test(s.getItem(it.id).name)) ?? v.items[0]).id;
    });
    const c = await tileCenter(page, id, '.gear-stash');
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await menuRow(page, 'Filter by item');
    await page.mouse.move(2, vp.height - 2); // off the tiles (no tooltip on the grid) and off the tab bar (no hover)
    await settle(page);
    const dim = await page.locator('.rg-itile--dim').count();
    if (!dim || !(await page.locator('.gear-stash', { hasText: /showing/i }).count())) throw new Error(`filter-by-item: dim ${dim}, no SHOWING chip`);
    await page.locator('.gear-stash').scrollIntoViewIfNeeded();
    await shot(page, 'filter-by-item', vp);
    await ctx.close();
  },
  async 'ctrl-drag'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    const id = await store(page, (s) => s.gridView({ kind: 'stash', location: s.stashLocation }).items.find((it) => it.w === 1 && it.h === 1).id);
    // Phone: the columns stack, so the stash is a screen away from the Filson; drag from the Pockets just above it.
    if (vp.tag === 'phone') await store(page, (s, id) => s.move(id, { kind: 'grid', grid: { kind: 'pockets' }, x: 0, y: 0, rotated: false }), id);
    const scope = vp.tag === 'phone' ? '.gear-carried' : '.gear-stash';
    const f = await tileCenter(page, FILSON, '.gear-carried');
    const a = await tileCenter(page, id, scope);
    await page.keyboard.down('Control');
    await dragTo(page, a, f, 12);
    await page.mouse.move(f.x + 1, f.y + 1);
    await page.waitForTimeout(80);
    const lit = await page.locator('.rg-tile--drop-ok').count();
    if (!lit) throw new Error('ctrl-drag: the Filson tile is not lit --ok');
    await shot(page, 'ctrl-drag', vp, { keepPointer: true });
    await page.mouse.up();
    await page.keyboard.up('Control');
    await settle(page);
    const anc = await store(page, (s, id) => { const p = s.effectivePlace(id); return p && p.kind === 'panel' ? p.in : null; }, id);
    if (anc !== FILSON) throw new Error(`ctrl-drag: ${id} landed in ${anc} (lit ${lit})`);
    await ctx.close();
  },
  async 'inspect-multi'(b, vp) {
    const { ctx, page } = await open(b, vp);
    const other = await store(page, (s) => s.gridView({ kind: 'stash', location: s.stashLocation }).items[0].id);
    await page.evaluate(({ a, b }) => { const ui = window.__ragmanUi.getState(); ui.inspect(a); ui.inspect(b); }, { a: MACBOOK, b: other });
    await page.waitForSelector('.rg-insp-win >> nth=1');
    await settle(page, 400);
    if ((await page.locator('.rg-insp-win').count()) !== 2) throw new Error('inspect-multi: not two windows');
    await shot(page, 'inspect-multi', vp);
    await ctx.close();
  },
  async 'delete-confirm'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    const c = await tileCenter(page, MACBOOK, '.gear-carried');
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Delete');
    await page.waitForSelector('.rg-cmenu');
    if (!(await page.locator('.rg-cmenu', { hasText: /Yes, delete/ }).count())) throw new Error('delete-confirm: no confirm');
    await settle(page);
    await shot(page, 'delete-confirm', vp);
    await ctx.close();
  },
  async split(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    const id = await store(page, (s) => {
      const v = s.gridView({ kind: 'stash', location: s.stashLocation });
      const it = [...v.items].sort((a, b) => a.y - b.y || a.x - b.x).find((x) => x.w === 1 && x.h === 1) ?? v.items[0];
      s.updateItem(it.id, { consumable: true });
      s.updateItem(it.id, { quantity: 30 });
      return it.id;
    });
    const c = await tileCenter(page, id, '.gear-stash');
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await menuRow(page, 'Split stack');
    await page.waitForSelector('.rg-cmenu__in--num');
    await settle(page);
    await shot(page, 'split', vp);
    await ctx.close();
  },

  /* ---- structure edits in the tool ---- */
  async 'edit-panels'(b, vp) {
    const { ctx, page } = await open(b, vp);
    const c = await tileCenter(page, FILSON, '.gear-carried');
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await menuRow(page, 'Edit');
    await page.waitForSelector('.rg-pe');
    await page.evaluate(() => document.querySelector('.rg-form__sect').scrollIntoView({ block: 'start' }));
    await settle(page, 300);
    await shot(page, 'edit-panels', vp);
    await ctx.close();
  },
  async 'edit-limit-quantity'(b, vp) {
    // The Drift's carry-on allowance typed into its Edit form (in memory, never saved).
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    const c = await tileCenter(page, DRIFT, '.gear-carried');
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await menuRow(page, 'Edit');
    await page.locator('input[aria-label="Weight limit (g)"]').fill('7000');
    await page.locator('input[aria-label="Weight limit (g)"]').scrollIntoViewIfNeeded();
    await carriedTop(page);
    await settle(page, 200);
    await shot(page, 'edit-limit', vp);
    await page.locator('.rg-modal__card button[type="submit"]').click();
    await settle(page);
    const lim = await store(page, (s, id) => s.weightOf(id).limit, DRIFT);
    if (lim !== 7000) throw new Error(`edit-limit: limit ${lim}`);
    // Add item: paste, name, save. A consumable stack of 30, no category needed.
    await page.locator('.gear-stash__head button', { hasText: /^Add$/ }).click();
    await page.waitForSelector('.rg-modal__card');
    await page.locator('.rg-modal__card input').first().fill('Vitamin D packet');
    await page.locator('.rg-modal__card label', { hasText: /Consumable/ }).locator('input').check();
    await page.locator('input[aria-label="Quantity"]').fill('30');
    await carriedTop(page);
    await page.evaluate(() => document.querySelector('input[aria-label="Quantity"]').scrollIntoView({ block: 'center' }));
    await settle(page, 200);
    await shot(page, 'add-quantity', vp);
    if (vp.tag === 'phone') {
      // the form's end: the Add button, enabled (only the name is required)
      await page.evaluate(() => { const c = document.querySelector('.rg-modal__card'); c.scrollTop = c.scrollHeight; });
      await settle(page, 100);
      if (await page.locator('.rg-modal__card button[type="submit"]').isDisabled()) throw new Error('add-quantity-end: Add is disabled');
      await shot(page, 'add-quantity-end', vp);
    }
    await page.locator('.rg-modal__card button[type="submit"]').click();
    await settle(page);
    const q = await store(page, (s) => s.getItem('vitamin-d-packet')?.quantity);
    if (q !== 30) throw new Error(`add-quantity: quantity ${q}`);
    await ctx.close();
  },
  async 'slots-editor'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    await page.locator('.gear-person__picker button', { hasText: /^Slots$/ }).click();
    await page.locator('input[aria-label="New slot name"]').fill('Belt');
    await page.locator('.gear-slots button[type="submit"]').click();
    await page.locator('input[aria-label="Pockets width"]').fill('5');
    await settle(page);
    const lo = await store(page, (s) => s.activeLoadout());
    if (!lo.slots.includes('Belt') || lo.pocketsGrid[0] !== 5) throw new Error(`slots-editor: ${JSON.stringify(lo.slots)} ${lo.pocketsGrid}`);
    await shot(page, 'slots-editor', vp, { fullPage: vp.tag === 'phone' });
    await ctx.close();
  },
  async 'attach-menu'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    const band = await store(page, (s) => Object.keys(s.inv.items).find((k) => s.attachTargets(k).length && !s.getItem(k).attachedTo));
    if (!band) throw new Error('attach-menu: no item with an attach target');
    const c = await tileCenter(page, band);
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await page.locator('.rg-cmenu [role="menuitem"]', { has: page.locator('.rg-cmenu__label', { hasText: /^Attach to$/ }) }).first().hover();
    await settle(page, 200);
    await shot(page, 'attach-menu', vp, { keepPointer: true });
    await ctx.close();
  },
  async 'tasks-authoring'(b, vp) {
    const { ctx, page } = await open(b, vp);
    await inMemory(page);
    await tab(page, 'Tasks');
    await page.locator('.rg-tasks__listhead button', { hasText: /New task/ }).click();
    await page.locator('input[aria-label="Task title"]').fill('Pack for Winter');
    await page.locator('.rg-tasks__new button[type="submit"]').click();
    await page.locator('input[aria-label="New objective"]').fill('Filson on back');
    await page.locator('.rg-quest__auto input').check();
    await page.locator('select[aria-label="Auto item"]').selectOption(FILSON);
    await page.locator('select[aria-label="Auto place"]').selectOption('Backpack');
    await page.locator('.rg-quest__add button[type="submit"]').click();
    await page.locator('.rg-quest__link select').selectOption(FILSON);
    await settle(page);
    const t = await store(page, (s) => s.tasksView().find((x) => x.title === 'Pack for Winter'));
    if (!t?.objectives[0]?.auto || t.itemId !== FILSON) throw new Error(`tasks-authoring: ${JSON.stringify(t)}`);
    await shot(page, 'tasks-authoring', vp, { fullPage: vp.tag === 'phone' });
    await ctx.close();
  },
};

/* ---------------- perf ---------------- */

async function perfRun(browser) {
  const vp = VIEWPORTS[0];
  const { ctx, page } = await open(browser, vp);
  await inMemory(page);
  await page.evaluate(() => { window.__ragmanPerf = []; window.__shotsPerf = []; });
  const counts = { drops: 0, switches: 0, opens: 0, sorts: 0 };
  // Event -> next frame, for real input: a one-shot capture listener on window takes the event's own timeStamp and
  // records when the frame after every handler ran has started. `sel`, when given, must be in the DOM by then.
  await page.evaluate(() => {
    window.__measureNext = (type, name, sel) => {
      const on = (e) => {
        window.removeEventListener(type, on, true);
        const t0 = e.timeStamp;
        requestAnimationFrame(() => setTimeout(() => {
          const ok = !sel || !!document.querySelector(sel);
          window.__shotsPerf.push({ name, ms: performance.now() - t0, ...(ok ? {} : { missing: sel }) });
        }, 0));
      };
      window.addEventListener(type, on, true);
    };
  });
  const measureNext = (type, name, sel) => page.evaluate(({ type, name, sel }) => window.__measureNext(type, name, sel), { type, name, sel });
  const bump = (k) => { counts[k] = (counts[k] ?? 0) + 1; };

  // 20 drops: a 1x1 stash item hops between two free cells by real pointer drags
  for (let i = 0; i < 20; i++) {
    const info = await stashInfo(page);
    const src = info.view.items.find((it) => it.w === 1 && it.h === 1 && onScreen(info, it));
    const free = freeCells(info).find((f) => f.x !== src.x || f.y !== src.y);
    await dragTo(page, cellPx(info, src.x, src.y), cellPx(info, free.x, free.y), 6);
    await page.mouse.up();
    await page.waitForTimeout(120);
    const p = await store(page, (s, id) => s.effectivePlace(id), src.id);
    if (p.x !== free.x || p.y !== free.y) throw new Error(`perf drop ${i} did not land (${JSON.stringify(p)})`);
    counts.drops++;
  }
  // 10 loadout switches by clicking the picker; also time click -> next frame in the page
  for (let i = 0; i < 10; i++) {
    const name = i % 2 === 0 ? 'Work' : 'Plane';
    await page.evaluate(async (name) => {
      const btn = [...document.querySelectorAll('.gear-person [role="radio"]')].find((b) => b.textContent.trim() === name);
      const t0 = performance.now();
      btn.click();
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      window.__shotsPerf.push({ name: 'shots:switchLoadout-to-frame', ms: performance.now() - t0 });
    }, name);
    await page.waitForTimeout(60);
    counts.switches++;
  }
  // 10 window opens: a real mouse double-click on the Filson's tile, timed from the dblclick event to the next
  // frame, which must already hold its window (ragman:openWindow also times the store action)
  for (let i = 0; i < 10; i++) {
    const f = await tileCenter(page, FILSON, '.gear-carried');
    await measureNext('dblclick', 'shots:dblclick-open-to-frame', '.gear-win');
    await page.mouse.dblclick(f.x, f.y);
    await page.waitForTimeout(80);
    if (!(await store(page, (s, id) => s.openWindows.includes(id), FILSON))) throw new Error('perf: double-click did not open the Filson');
    await store(page, (s, id) => s.closeWindow(id), FILSON);
    await page.waitForTimeout(40);
    counts.opens++;
  }
  // 10 sorts: the Sort button, cycling the sort mode so each one repacks
  const modes = ['size-desc', 'name', 'category', 'status'];
  for (let i = 0; i < 10; i++) {
    await store(page, (s, m) => s.setFilters({ sort: m }), modes[i % modes.length]);
    await page.evaluate(async () => {
      const btn = [...document.querySelectorAll('.gear-stash__head button')].find((b) => b.textContent.trim() === 'Sort');
      const t0 = performance.now();
      btn.click();
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      window.__shotsPerf.push({ name: 'shots:sort-to-frame', ms: performance.now() - t0 });
    });
    await page.waitForTimeout(60);
    counts.sorts++;
  }

  const stashTile = async (pred) => {
    const id = await store(page, (s, src) => {
      const p = (0, eval)(`(${src})`);
      return s.gridView({ kind: 'stash', location: s.stashLocation }).items.find((it) => p(it, s))?.id ?? null;
    }, pred.toString());
    if (!id) throw new Error(`perf: no stash tile for ${pred}`);
    return { id, c: await tileCenter(page, id, '.gear-stash') };
  };
  const PLAIN = (it, s) => it.w === 1 && it.h === 1 && !s.isContainer(it.id) && !s.getItem(it.id).locked;

  // 10 hover tooltips: from the tooltip being due (after its designed 160 ms delay) to the frame that draws it
  for (let i = 0; i < 10; i++) {
    const { id } = await stashTile(PLAIN);
    await page.evaluate(async (id) => {
      const t0 = performance.now();
      window.__ragmanUi.getState().showTooltip(id, 300, 300);
      while (!document.querySelector('.rg-tooltip')) await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      window.__shotsPerf.push({ name: 'shots:tooltip-to-frame', ms: performance.now() - t0 });
      window.__ragmanUi.getState().hideTooltip();
    }, id);
    bump('tooltips');
  }
  // 10 right-click menus and 10 Inspect opens (real mouse)
  for (let i = 0; i < 10; i++) {
    const { c } = await stashTile(PLAIN);
    await measureNext('contextmenu', 'shots:contextmenu-to-frame', '.rg-cmenu');
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await page.waitForTimeout(60);
    await page.keyboard.press('Escape');
    bump('menus');
  }
  for (let i = 0; i < 10; i++) {
    const { id, c } = await stashTile(PLAIN);
    await measureNext('dblclick', 'shots:inspect-to-frame', '.rg-insp-win');
    await page.mouse.dblclick(c.x, c.y);
    await page.waitForTimeout(80);
    await page.evaluate((id) => window.__ragmanUi.getState().closeInspect(id), id);
    bump('inspects');
  }
  // 10 Alt-click equips, each followed by a Ctrl-click back to the stash (from its slot box)
  for (let i = 0; i < 10; i++) {
    const { id, c } = await stashTile((it, s) => it.w === 1 && it.h === 1 && !s.isContainer(it.id) && !s.getItem(it.id).locked
      && s.activeLoadout().slots.some((sl) => s.canFit(it.id, { kind: 'slot', slot: sl }).ok));
    await measureNext('click', 'shots:altclick-equip-to-frame');
    await page.keyboard.down('Alt');
    await page.mouse.click(c.x, c.y);
    await page.keyboard.up('Alt');
    await page.waitForTimeout(80);
    const slot = await store(page, (s, id) => s.effectivePlace(id), id);
    if (slot?.kind !== 'slot') throw new Error(`perf: Alt-click did not equip ${id} (${JSON.stringify(slot)})`);
    bump('altEquips');
    const back = await tileCenter(page, id, '.gear-person');
    await measureNext('click', 'shots:ctrlclick-stash-to-frame');
    await page.keyboard.down('Control');
    await page.mouse.click(back.x, back.y);
    await page.keyboard.up('Control');
    await page.waitForTimeout(80);
    const home = await store(page, (s, id) => s.effectivePlace(id), id);
    if (home?.kind !== 'stash') throw new Error(`perf: Ctrl-click did not stash ${id}`);
    bump('ctrlStash');
  }
  // 10 Ctrl-drag quick moves into the Filson (tile in the middle column), each undone with Ctrl-Z
  for (let i = 0; i < 10; i++) {
    const { id, c } = await stashTile(PLAIN);
    const f = await tileCenter(page, FILSON, '.gear-carried');
    await page.keyboard.down('Control');
    await dragTo(page, c, f, 8);
    await measureNext('pointerup', 'shots:ctrldrag-drop-to-frame');
    await page.mouse.up();
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);
    const p = await store(page, (s, id) => s.effectivePlace(id), id);
    if (p?.kind !== 'panel' || p.in !== FILSON) throw new Error(`perf: Ctrl-drag did not land ${id} in the Filson (${JSON.stringify(p)})`);
    bump('ctrlDrags');
    await page.mouse.move(2, 2);
    await measureNext('keydown', 'shots:ctrlz-undo-to-frame');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    const u = await store(page, (s, id) => s.effectivePlace(id), id);
    if (u?.kind !== 'stash') throw new Error(`perf: Ctrl-Z did not undo ${id}`);
    bump('undos');
  }
  // 10 R-rotates while dragging a non-square item
  for (let i = 0; i < 10; i++) {
    const { c } = await stashTile((it, s) => it.w !== it.h && !s.getItem(it.id).locked);
    await dragTo(page, c, { x: c.x + 30, y: c.y + 30 }, 4);
    await measureNext('keydown', 'shots:rotate-to-frame', '.rg-ghost, [class*="ghost"]');
    await page.keyboard.press('r');
    await page.waitForTimeout(60);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(120);
    bump('rotates');
  }
  // 10 archives through the menu, each unarchived from the store
  for (let i = 0; i < 10; i++) {
    const { id, c } = await stashTile(PLAIN);
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await measureNext('click', 'shots:archive-to-frame');
    await menuRow(page, 'Archive');
    await page.waitForTimeout(80);
    if ((await store(page, (s, id) => s.getItem(id).status, id)) !== 'Not Worn') throw new Error(`perf: ${id} not archived`);
    await store(page, (s, id) => s.unarchive(id), id);
    bump('archives');
  }
  // 10 Add item saves (name only) through the form
  for (let i = 0; i < 10; i++) {
    await page.locator('.gear-stash__head button', { hasText: /^Add$/ }).click();
    await page.waitForSelector('.rg-modal__card');
    await page.locator('.rg-modal__card input').first().fill(`Perf item ${i}`);
    await measureNext('click', 'shots:add-item-to-frame');
    await page.locator('.rg-modal__card button[type="submit"]').click();
    await page.waitForTimeout(100);
    if (await page.locator('.rg-modal__card').count()) throw new Error('perf: Add item form did not close');
    bump('adds');
  }
  // 10 searches (one keystroke each) and 10 filter strip clicks
  const search = page.locator('.gear-stash__search input');
  for (let i = 0; i < 10; i++) {
    await search.focus();
    await measureNext('input', 'shots:search-to-frame');
    await page.keyboard.type(i % 2 ? 'l' : 'e');
    await page.waitForTimeout(60);
    bump('searches');
  }
  await search.fill('');
  for (let i = 0; i < 10; i++) {
    const btn = page.locator('.gear-filter button').nth(i % 3);
    await measureNext('click', 'shots:filter-strip-to-frame');
    await btn.click();
    await page.waitForTimeout(60);
    bump('filters');
  }
  await store(page, (s) => s.setFilters({ categories: new Set() }));

  // Stash header: 10 location switches (real clicks on the switcher, ending where it started) and 10 Archive toggles
  const startLoc = await store(page, (s) => s.stashLocation);
  const locs = await page.locator('.gear-stash__head [role="radio"]').allTextContents();
  if (locs.length < 2) throw new Error(`perf: the stash location switcher has ${locs.length} option(s)`);
  const other = locs.map((l) => l.trim()).find((l) => l !== startLoc);
  for (let i = 0; i < 10; i++) {
    const to = i % 2 === 0 ? other : startLoc;
    await measureNext('click', 'shots:stash-location-to-frame', `.gear-stash__head [role="radio"][aria-checked="true"]`);
    await page.locator('.gear-stash__head').getByRole('radio', { name: to, exact: true }).click();
    await page.waitForTimeout(60);
    if ((await store(page, (s) => s.stashLocation)) !== to) throw new Error(`perf: location switch did not reach ${to}`);
    bump('locationSwitches');
  }
  const archiveBtn = page.locator('.gear-stash__head button', { hasText: /^Archive$/ });
  for (let i = 0; i < 10; i++) {
    await measureNext('click', 'shots:archive-toggle-to-frame');
    await archiveBtn.click();
    await page.waitForTimeout(60);
    if ((await store(page, (s) => s.showArchive)) !== (i % 2 === 0)) throw new Error('perf: Archive toggle did not flip');
    bump('archiveToggles');
  }

  // 10 Edit saves: menu Edit, change the name, Save; timed from the Save click to the next frame (form closed)
  for (let i = 0; i < 10; i++) {
    const { id, c } = await stashTile(PLAIN);
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await menuRow(page, 'Edit');
    await page.waitForSelector('.rg-modal__card');
    const name = `Perf edit ${i}`;
    await page.locator('.rg-modal__card input').first().fill(name);
    await measureNext('click', 'shots:edit-save-to-frame');
    await page.locator('.rg-modal__card button[type="submit"]').click();
    await page.waitForTimeout(100);
    if (await page.locator('.rg-modal__card').count()) throw new Error('perf: Edit form did not close');
    if ((await store(page, (s, id) => s.getItem(id).name, id)) !== name) throw new Error(`perf: Edit did not save ${id}`);
    bump('edits');
  }
  // 10 Deletes: menu Delete, then the inline confirm; timed from the confirm click to the next frame
  for (let i = 0; i < 10; i++) {
    const { id, c } = await stashTile(PLAIN);
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await menuRow(page, 'Delete');
    await measureNext('click', 'shots:delete-confirm-to-frame');
    await menuRow(page, 'Yes, delete');
    await page.waitForTimeout(80);
    if (await store(page, (s, id) => !!s.inv.items[id], id)) throw new Error(`perf: ${id} not deleted`);
    bump('deletes');
  }

  const { app, script } = await page.evaluate(() => ({ app: window.__ragmanPerf ?? [], script: window.__shotsPerf ?? [] }));
  const missing = script.filter((m) => m.missing);
  if (missing.length) throw new Error(`perf: no frame drew ${[...new Set(missing.map((m) => `${m.name} (${m.missing})`))].join(', ')}`);
  await ctx.close();

  const summarise = (list) => {
    const by = {};
    for (const m of list) (by[m.name] ??= []).push(m.ms);
    const out = {};
    for (const [k, v] of Object.entries(by)) {
      const s = [...v].sort((a, b) => a - b);
      out[k] = {
        count: v.length,
        max: +s[s.length - 1].toFixed(2),
        mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2),
        p95: +s[Math.min(s.length - 1, Math.floor(s.length * 0.95))].toFixed(2),
      };
    }
    return out;
  };
  const over = [...app, ...script].filter((m) => m.ms >= 100).map((m) => ({ name: m.name, ms: +m.ms.toFixed(2) }));
  const report = {
    when: new Date().toISOString(),
    viewport: `${vp.width}x${vp.height}`,
    budgetMs: 100,
    counts,
    note: 'ragman:* come from window.__ragmanPerf (store mutations and ragman:ui:drop, the drop including its synchronous render). '
      + 'shots:* are timed by this script inside the page: event dispatch to the next animation frame. '
      + 'ragman:openWindow, ragman:setStashLocation and ragman:setShowArchive time those view actions in the store. '
      + 'Covers every interaction of brief section 7: drop, loadout switch, double-click window open, sort, hover tooltip (from the '
      + 'moment it is due, after its designed 160 ms delay), right-click menu, Inspect open, Alt-click equip, Ctrl-click '
      + 'to stash, Ctrl-drag quick move, Ctrl-Z undo, R rotate, archive, add item, search, filter strip, the Stash header '
      + '(location switch and Archive toggle), Edit save and Delete confirm. '
      + 'Run on an in-memory copy of the real inventory (no saves).',
    measures: summarise(app),
    scriptMeasures: summarise(script),
    over100: over,
    pass: over.length === 0,
    raw: app.map((m) => ({ name: m.name, ms: +m.ms.toFixed(3) })),
    scriptRaw: script.map((m) => ({ name: m.name, ms: +m.ms.toFixed(3) })),
  };
  writeFileSync(join(OUT, 'perf.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

/* ---------------- main ---------------- */

const failures = [];
await startVite();
const browser = await chromium.launch();
try {
  for (const [name, fn] of Object.entries(SHOTS)) {
    if (only.length && !only.includes(name) && !only.includes('shots')) continue;
    for (const vp of VIEWPORTS) {
      try { await fn(browser, vp); console.log(`ok   ${name}-${vp.tag}`); }
      catch (e) { failures.push(`${name}-${vp.tag}: ${e.message}`); console.log(`FAIL ${name}-${vp.tag}: ${e.message}`); }
    }
  }
  if (!only.length || only.includes('perf')) {
    try {
      const r = await perfRun(browser);
      console.log(`perf ${r.pass ? 'PASS' : 'FAIL'}: ${JSON.stringify(r.measures)} ${JSON.stringify(r.scriptMeasures)}`);
      if (!r.pass) failures.push(`perf over 100 ms: ${JSON.stringify(r.over100)}`);
    } catch (e) { failures.push(`perf: ${e.message}`); console.log(`FAIL perf: ${e.message}`); }
  }
} finally {
  await browser.close();
  stopVite();
}
if (pageErrors.length) console.log(`page errors:\n  ${[...new Set(pageErrors)].join('\n  ')}`);
if (failures.length) { console.log(`\n${failures.length} failure(s):\n  ${failures.join('\n  ')}`); process.exitCode = 1; }
else console.log('\nall shots written to refs/proof/');
