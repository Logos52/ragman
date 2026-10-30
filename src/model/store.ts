/**
 * The zustand store implementing api.ts (InventoryStore). UI code uses `useInventory`; non-React code `getStore()`.
 *
 * Mutations: build a structuredClone draft, apply an engine function, push the previous inv as an undo snapshot,
 * share the draft against the previous inv (engine/share.ts: every untouched item, placement or loadout keeps its
 * reference, so memoised tiles skip re-rendering), set it (a new root reference, so React selectors see the
 * change), schedule the debounced save. Undo shares the restored snapshot against the current inv the same way.
 * Each mutation (and the timed view actions: stash location, Archive toggle, window open) is timed with
 * performance.mark/measure `ragman:<action>`; {name, ms} also goes to window.__ragmanPerf.
 *
 * Reads are memoised per inv reference: anything returning an object or array returns the SAME reference until
 * inv changes, so `useInventory(s => s.gridView(ref))` is a stable selector (zustand v5 needs that).
 */
import { create } from 'zustand';
import type { InventoryStore } from './api';
import type { DataSource, DropTarget, Filters, FitResult, GridRef, GridView, Inventory, Loadout, SplitResult, Task } from './types';
import { buildLinks, contentsOf, effectivePlace, footprintOf, gridBuckets, gridView, isContainer, refKey, type Links } from './engine/place';
import { canFit, slotOccupant } from './engine/fit';
import { carriedWeight, weightOf } from './engine/weights';
import { switchLoadout } from './engine/loadout';
import { sortGrid } from './engine/sort';
import { setTaskStatus, taskChecklist, tasksView, updateTask } from './engine/tasks';
import { quantityOf, sameJob, sameProduct } from './engine/stacks';
import { UndoRing } from './engine/undo';
import { ImageResolver, imagePath } from './engine/images';
import { exportJson, type Eol } from './engine/strip';
import { normalize } from './engine/normalize';
import { share } from './engine/share';
import * as M from './engine/moves';
import * as S from './engine/structure';
import {
  bundledImageUrls, canPickFolder, hasPermission, IS_PUBLIC, loadBundled, loadFolder, loadServer, pickFolder,
  recallHandle, rememberHandle, saveImage as persistImage, Saver, SERVER_BASE, writeInventory,
} from './persist';

declare global { interface Window { __ragmanPerf?: { name: string; ms: number }[] } }

/** Extra state beyond api.ts: bumps when a lazily loaded image or the avatar probe finishes, so selectors re-run. */
export interface StoreExtras { imagesTick: number }
export type RagmanStore = InventoryStore & StoreExtras;

export const CARRY_SLOTS = ['Pockets', 'Backpack', 'Carry-on', 'Pouch'];
const EMPTY_LOADOUT: Loadout = { slots: [], pocketsGrid: [4, 1], placements: {} };
const PERF_CAP = 500;

/* ---------------- module state (not React state) ---------------- */

const undoRing = new UndoRing<Inventory>(10);
let saver: Saver | null = null;
let images: ImageResolver | null = null;
/** Set by the store initialiser so adoptInventory() can reach adopt(). */
let adoptHook: ((raw: Inventory, source: DataSource, eol?: Eol) => void) | null = null;

/* ---------------- memo per inv reference ---------------- */

interface Memo { inv: Inventory; buckets?: ReturnType<typeof gridBuckets>; links?: Links; maps: Map<string, Map<string, unknown>>; filters?: Filters }
let memo: Memo | null = null;
function memoFor(inv: Inventory): Memo {
  if (!memo || memo.inv !== inv) memo = { inv, maps: new Map() };
  return memo;
}
function cached<T>(inv: Inventory, bucket: string, key: string, compute: () => T): T {
  const m = memoFor(inv);
  let map = m.maps.get(bucket);
  if (!map) { map = new Map(); m.maps.set(bucket, map); }
  if (map.size > 2000) map.clear(); // canFit keys during long drags
  if (map.has(key)) return map.get(key) as T;
  const v = compute();
  map.set(key, v);
  return v;
}
const linksOf = (inv: Inventory) => { const m = memoFor(inv); return (m.links ??= buildLinks(inv)); };
const viewOf = (inv: Inventory, ref: GridRef): GridView =>
  cached(inv, 'view', refKey(ref), () => { const m = memoFor(inv); return gridView(inv, ref, (m.buckets ??= gridBuckets(inv))); });

/* ---------------- perf ---------------- */

function perf<T>(name: string, fn: () => T): T {
  const label = `ragman:${name}`;
  const t0 = performance.now();
  try { performance.mark(`${label}:start`); } catch { /* old browsers */ }
  try { return fn(); }
  finally {
    const ms = performance.now() - t0;
    try { performance.measure(label, `${label}:start`); performance.clearMarks(`${label}:start`); } catch { /* ignore */ }
    if (typeof window !== 'undefined') {
      const log = (window.__ragmanPerf ??= []);
      log.push({ name: label, ms });
      if (log.length > PERF_CAP) log.splice(0, log.length - PERF_CAP);
    }
  }
}

/* ---------------- filters ---------------- */

function matches(inv: Inventory, id: string, f: Filters): boolean {
  const it = inv.items[id];
  if (f.categories.size && !f.categories.has(it.category)) return false;
  const q = f.search.trim().toLowerCase();
  if (!q) return true;
  return [it.name, it.nameEn, it.maker, it.category, it.color, ...(it.tags ?? [])].some((s) => s?.toLowerCase().includes(q));
}

function sorted(inv: Inventory, ids: string[], f: Filters): string[] {
  const name = (a: string, b: string) => inv.items[a].name.localeCompare(inv.items[b].name) || a.localeCompare(b);
  const idx = (list: string[], v: string | undefined) => { const i = v ? list.indexOf(v) : -1; return i < 0 ? list.length : i; };
  const area = (id: string) => { const [w, h] = footprintOf(inv.items[id]); return w * h; };
  const cmp: Record<Filters['sort'], (a: string, b: string) => number> = {
    'name': name,
    'category': (a, b) => idx(inv.settings.categories, inv.items[a].category) - idx(inv.settings.categories, inv.items[b].category) || name(a, b),
    'status': (a, b) => idx(inv.settings.statuses, inv.items[a].status) - idx(inv.settings.statuses, inv.items[b].status) || name(a, b),
    'size-desc': (a, b) => area(b) - area(a) || name(a, b),
  };
  return [...ids].sort(cmp[f.sort]);
}

/* ---------------- the store ---------------- */

class Abort { constructor(readonly value: unknown) {} }

export const useInventory = create<RagmanStore>()((set, get) => {
  /** One undoable mutation step. `fn` mutates the draft; returning false (or an Abort) means "no change". */
  function mutate<R>(name: string, fallback: R, fn: (draft: Inventory, stashLocation: string) => R | false | Abort): R {
    return perf(name, () => {
      const inv = get().inv;
      if (!inv) return fallback;
      const draft = structuredClone(inv);
      const r = fn(draft, get().stashLocation);
      if (r === false) return fallback;
      if (r instanceof Abort) return r.value as R;
      undoRing.push(inv);
      set({ inv: share(inv, draft), undoDepth: undoRing.depth });
      saver?.schedule();
      return r;
    });
  }

  function adopt(raw: Inventory, source: DataSource, eol: Eol = '\n') {
    const inv = normalize(raw);
    images?.dispose();
    images = new ImageResolver(source, {
      bundledUrls: source.kind === 'bundled' ? bundledImageUrls() : undefined,
      bundledBase: `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data`,
      onChange: () => set((s) => ({ imagesTick: s.imagesTick + 1 })),
    });
    saver?.cancel();
    saver = source.kind === 'bundled' ? null : new Saver(
      (text) => writeInventory(source, text),
      () => get().inv,
      (saveState, saveError) => set({ saveState, saveError }),
      500, eol,
    );
    undoRing.clear();
    set({
      inv, source, loadError: null, saveState: 'saved', saveError: null, undoDepth: 0, openWindows: [],
      stashLocation: inv.settings.locations[0] ?? '', showArchive: false,
    });
    void images.probeAvatar();
  }
  adoptHook = adopt;

  const fail = (e: unknown) => set({ loadError: e instanceof Error ? e.message : String(e) });

  return {
    inv: null, source: null, loadError: null, saveState: 'saved', saveError: null,
    filters: { categories: new Set<string>(), search: '', sort: 'name' },
    stashLocation: '', showArchive: false, openWindows: [], undoDepth: 0, imagesTick: 0,

    /* ---- loading / saving ---- */
    async boot() {
      try {
        if (IS_PUBLIC) { const b = await loadBundled(); adopt(b.inv, { kind: 'bundled' }, b.eol); return; }
        const raw = await loadServer();
        if (raw) { adopt(raw.inv, { kind: 'server', base: SERVER_BASE }, raw.eol); return; }
        const h = await recallHandle();
        if (h && (await hasPermission(h, false))) { const f = await loadFolder(h); adopt(f.inv, { kind: 'folder', handle: h }, f.eol); return; }
        set({ loadError: h ? 'Re-open the ragman-data folder to allow access.' : 'No data server found. Open the ragman-data folder.' });
      } catch (e) { fail(e); }
    },
    async openFolder() {
      try {
        let h = await recallHandle();
        if (!h || !(await hasPermission(h, true))) {
          if (!canPickFolder()) { set({ loadError: 'This browser cannot open a folder (use Chrome or Edge).' }); return; }
          h = await pickFolder();
          await rememberHandle(h);
        }
        const f = await loadFolder(h);
        adopt(f.inv, { kind: 'folder', handle: h }, f.eol);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // the user closed the picker
        fail(e);
      }
    },
    async saveNow() { await saver?.flush(true); },
    async saveImage(relPath, blob) {
      const source = get().source;
      if (!source) throw new Error('no data source');
      const p = await persistImage(source, relPath, blob);
      images?.register(p, blob);
      set((s) => ({ imagesTick: s.imagesTick + 1 }));
      return p;
    },

    /* ---- reading ---- */
    getItem: (id) => get().inv?.items[id],
    effectivePlace: (id) => { const inv = get().inv; return inv ? effectivePlace(inv, id) : null; },
    footprintOf(id, rotated) {
      const inv = get().inv;
      if (!inv) return [1, 1];
      const p = effectivePlace(inv, id);
      const r = rotated ?? (p && p.kind !== 'slot' ? p.rotated : false);
      return cached(inv, 'fp', `${id}|${r}`, () => footprintOf(inv.items[id], r));
    },
    isContainer: (id) => isContainer(get().inv?.items[id]),
    contentsOf(containerId, deep = false) {
      const inv = get().inv;
      return inv ? cached(inv, 'contents', `${containerId}|${deep}`, () => contentsOf(linksOf(inv), containerId, deep)) : [];
    },
    attachmentsOf(id) {
      const inv = get().inv;
      return inv ? cached(inv, 'attach', id, () => [...(linksOf(inv).attachments.get(id) ?? [])]) : [];
    },
    gridView(ref) {
      const inv = get().inv;
      if (!inv) return { ref, width: 0, height: 0, accepts: null, regions: [], items: [] };
      return viewOf(inv, ref);
    },
    slotItem: (slot) => { const inv = get().inv; return inv ? slotOccupant(inv, slot) : null; },
    carrySlots() {
      const inv = get().inv;
      return inv ? cached(inv, 'carry', '', () => CARRY_SLOTS.filter((s) => get().activeLoadout().slots.includes(s))) : [];
    },
    weightOf(containerId) {
      const inv = get().inv;
      if (!inv) return { grams: 0, unweighed: 0, estimated: 0, limit: null, overLimit: false };
      return cached(inv, 'weight', containerId, () => weightOf(inv, containerId, linksOf(inv)));
    },
    carriedWeight() {
      const inv = get().inv;
      if (!inv) return { grams: 0, unweighed: 0, estimated: 0, limit: null, overLimit: false };
      return cached(inv, 'carried', '', () => carriedWeight(inv, linksOf(inv)));
    },
    imageUrl(id, kind) {
      const inv = get().inv;
      return inv && images ? images.url(imagePath(inv.items[id], kind)) : null;
    },
    avatarBaseUrl: () => images?.avatarUrl() ?? null,
    canFit(id, target) {
      const inv = get().inv;
      if (!inv) return { ok: false, cells: [], reason: 'not-accepted' };
      return cached(inv, 'fit', `${id}|${JSON.stringify(target)}`, () => canFit(inv, id, target, (r) => viewOf(inv, r)));
    },
    filteredIds(ref) {
      const { inv, filters } = get();
      if (!inv) return [];
      const m = memoFor(inv);
      if (m.filters !== filters) { m.maps.delete('filtered'); m.filters = filters; }
      return cached(inv, 'filtered', refKey(ref), () =>
        sorted(inv, viewOf(inv, ref).items.map((v) => v.id).filter((id) => matches(inv, id, filters)), filters));
    },
    sameJob(id) { const inv = get().inv; return inv ? cached(inv, 'sameJob', id, () => sameJob(inv, id)) : []; },
    quantityOf: (id) => quantityOf(get().inv?.items[id]),
    canMerge(source, target) {
      const inv = get().inv;
      const a = inv?.items[source], b = inv?.items[target];
      return !!a && !!b && source !== target && !a.locked && !b.locked && sameProduct(a, b);
    },
    activeLoadout: () => { const inv = get().inv; return (inv && inv.loadouts[inv.activeLoadout]) || EMPTY_LOADOUT; },
    tasksView() { const inv = get().inv; return inv ? cached(inv, 'tasks', '', () => tasksView(inv)) : []; },
    canAttach(id, parent, slot) { const inv = get().inv; return !!inv && S.attachRefusal(inv, id, parent, slot) === null; },
    attachTargets(id) {
      const inv = get().inv;
      if (!inv) return [];
      return cached(inv, 'attachTargets', id, () => {
        const out: { parent: string; slot: string }[] = [];
        for (const [pid, p] of Object.entries(inv.items)) {
          for (const slot of p.attachmentSlots ?? []) if (S.attachRefusal(inv, id, pid, slot) === null) out.push({ parent: pid, slot });
        }
        return out;
      });
    },

    /* ---- mutations ---- */
    move(id, target) {
      const inv = get().inv;
      if (!inv) return { ok: false, cells: [], reason: 'not-accepted' };
      const fit = get().canFit(id, target);
      if (!fit.ok) return fit;
      return mutate('move', fit, (d, loc) => (M.moveItem(d, id, target, loc) ? fit : new Abort(fit)));
    },
    quickMoveInto(id, containerId) {
      const none: FitResult = { ok: false, cells: [], reason: 'not-accepted' };
      return mutate('quickMoveInto', none, (d, loc) => { const r = M.quickMoveInto(d, id, containerId, loc); return r.ok ? r : new Abort(r); });
    },
    equip: (id, slot) => mutate('equip', false, (d, loc) => M.equipItem(d, id, loc, slot) && true),
    sendToStash: (id) => mutate('sendToStash', undefined, (d, loc) => M.sendToStash(d, id, loc) && undefined),
    archive: (id) => mutate('archive', undefined, (d) => M.archiveItem(d, id) && undefined),
    unarchive: (id, target?: DropTarget) => mutate('unarchive', undefined, (d, loc) => M.unarchiveItem(d, id, loc, target) && undefined),
    setQuickUse: (index, id) => mutate('setQuickUse', undefined, (d) => M.setQuickUse(d, index, id) && undefined),
    setPinned: (id, on) => mutate('setPinned', undefined, (d) => M.setPinned(d, id, on) && undefined),
    setLocked: (id, on) => mutate('setLocked', undefined, (d) => M.setLocked(d, id, on) && undefined),
    setVerified: (id, on) => mutate('setVerified', undefined, (d) => M.setVerified(d, id, on) && undefined),
    setVerifiedAll: (on) => mutate('setVerifiedAll', undefined, (d) => M.setVerifiedAll(d, on) && undefined),
    unverifiedIds() {
      const inv = get().inv;
      if (!inv) return [];
      return cached(inv, 'unverified', '', () => Object.keys(inv.items).filter((id) => !inv.items[id].verified));
    },
    setNickname: (id, nickname) => mutate('setNickname', undefined, (d) => M.setNickname(d, id, nickname) && undefined),
    mergeStacks: (source, target) => mutate('mergeStacks', false, (d, loc) => M.mergeStacks(d, source, target, loc) && true),
    splitStack(id, n, target) {
      const none: SplitResult = { ok: false, cells: [], reason: 'not-accepted' };
      return mutate('splitStack', none, (d, loc) => { const r = M.splitStack(d, id, n, loc, target); return r.ok ? r : new Abort(r); });
    },
    sortGrid: (ref, mode) => {
      const m = mode ?? get().filters.sort;
      return mutate('sortGrid', undefined, (d) => sortGrid(d, ref, m) && undefined);
    },
    switchLoadout: (name) => mutate('switchLoadout', undefined, (d) => {
      if (!d.loadouts[name] || d.activeLoadout === name) return false;
      switchLoadout(d, name);
      return undefined;
    }),
    // Not undoable (view state, not data), but timed like the mutations: each is a section 7 interaction.
    setStashLocation: (stashLocation) => perf('setStashLocation', () => set({ stashLocation })),
    setShowArchive: (showArchive) => perf('setShowArchive', () => set({ showArchive })),
    setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
    openWindow: (id) => perf('openWindow', () => set((s) => ({ openWindows: [...s.openWindows.filter((w) => w !== id), id] }))),
    closeWindow: (id) => set((s) => ({ openWindows: s.openWindows.filter((w) => w !== id) })),
    raiseWindow: (id) => set((s) => (s.openWindows.includes(id) ? { openWindows: [...s.openWindows.filter((w) => w !== id), id] } : {})),
    updateItem: (id, patch) => mutate('updateItem', undefined, (d, loc) => M.updateItem(d, id, patch, loc) && undefined),
    addItem: (id, item) => mutate('addItem', undefined, (d, loc) => M.addItem(d, id, item, loc) && undefined),
    deleteItem(id) {
      mutate('deleteItem', undefined, (d, loc) => M.deleteItem(d, id, loc) && undefined);
      if (!get().inv?.items[id]) set((s) => ({ openWindows: s.openWindows.filter((w) => w !== id) })); // a locked item stays
    },
    setObjectiveDone: (taskId, index, done) => mutate('setObjectiveDone', undefined, (d) => {
      const o = d.tasks.find((t) => t.id === taskId)?.objectives[index];
      if (!o) return false;
      o.done = done;
      return undefined;
    }),
    setTaskStatus: (taskId, status) => mutate('setTaskStatus', undefined, (d) => setTaskStatus(d, taskId, status) && undefined),
    addTask: (task: Task) => mutate('addTask', undefined, (d) => {
      if (d.tasks.some((t) => t.id === task.id)) return false;
      d.tasks.push(structuredClone(task));
      return undefined;
    }),
    updateTask: (id, patch) => mutate('updateTask', undefined, (d) => updateTask(d, id, patch) && undefined),
    deleteTask: (id) => mutate('deleteTask', undefined, (d) => {
      const n = d.tasks.length;
      d.tasks = d.tasks.filter((t) => t.id !== id);
      return d.tasks.length === n ? false : undefined;
    }),
    setLoadoutPlacement: (id, place) => mutate('setLoadoutPlacement', undefined, (d) => {
      const lo = d.loadouts[d.activeLoadout];
      if (!lo || !d.items[id]) return false;
      if (place) lo.placements[id] = structuredClone(place); else delete lo.placements[id];
      return undefined;
    }),
    setPanels: (id, panels, from) => mutate('setPanels', false, (d, loc) => S.setPanels(d, id, panels, from, loc) && true),
    setLoadoutSlots: (slots) => mutate('setLoadoutSlots', false, (d) => S.setLoadoutSlots(d, slots) && true),
    setPocketsGrid: (grid) => mutate('setPocketsGrid', false, (d) => S.setPocketsGrid(d, grid) && true),
    attach: (id, parent, slot) => mutate('attach', false, (d, loc) => S.attach(d, id, parent, slot, loc) && true),
    detach: (id) => mutate('detach', false, (d, loc) => S.detach(d, id, loc) && true),
    undo() {
      perf('undo', () => {
        const prev = undoRing.pop();
        const cur = get().inv;
        if (!prev || !cur) return;
        set({ inv: share(cur, prev), undoDepth: undoRing.depth });
        saver?.schedule();
      });
    },
    exportJson: () => { const inv = get().inv; return inv ? exportJson(inv) : ''; },
    exportTaskChecklist(taskId) {
      const t = get().tasksView().find((x) => x.id === taskId);
      return t ? taskChecklist(t) : '';
    },
  };
});

/** For non-React code (keyboard handlers, scripts, tests). */
export function getStore(): RagmanStore { return useInventory.getState(); }

/** Load an inventory directly (tests, tools). Normalises it like boot() does. */
export function adoptInventory(raw: Inventory, source: DataSource = { kind: 'bundled' }, eol: Eol = '\n'): void {
  adoptHook?.(raw, source, eol);
}
