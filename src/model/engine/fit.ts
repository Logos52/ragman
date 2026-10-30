/**
 * The fit rule: can item `id` be dropped on `target`? Pure; O(footprint cells + grid items).
 * Order of checks: locked (canFit only), self/cycle, stash-only category (furniture never nests), bounds, accepts (panel + regions), occupied.
 * canFit (not fitAt) also answers a grid drop onto exactly one identical stack with ok + `merge`: move() merges.
 */
import type { Cell, DropTarget, FitResult, GridRef, GridView, Inventory, Item, Region } from '../types';
import { ancestorsOf, footprintOf, gridView, isGrowing, occupancy, POCKETS_PANEL } from './place';

export type ViewFn = (ref: GridRef) => GridView;

import { slotAccepts, stashOnly } from './slotRules';
import { sameProduct } from './stacks';
export { CONTAINER_SLOTS } from './slotRules';

/** An accepts list matches an item's tags or its category; null/undefined means anything. */
export function acceptsItem(list: string[] | null | undefined, item: Item): boolean {
  if (!list) return true;
  return list.some((n) => n === item.category || (item.tags ?? []).includes(n));
}

/** A footprint touching a region at all must be accepted by that region. Items the region accepts may also sit outside it. */
export function regionsAccept(regions: Region[], item: Item, x: number, y: number, w: number, h: number): boolean {
  for (const r of regions) {
    const overlap = x < r.at[0] + r.size[0] && x + w > r.at[0] && y < r.at[1] + r.size[1] && y + h > r.at[1];
    if (overlap && !acceptsItem(r.accepts, item)) return false;
  }
  return true;
}

function cellsOf(x: number, y: number, w: number, h: number): Cell[] {
  const out: Cell[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([x + dx, y + dy]);
  return out;
}

/** Fit of item `id` at (x, y) in a grid. */
export function fitAt(inv: Inventory, id: string, ref: GridRef, x: number, y: number, rotated: boolean, view: ViewFn = (r) => gridView(inv, r)): FitResult {
  const item = inv.items[id];
  const [w, h] = footprintOf(item, rotated);
  const cells = cellsOf(x, y, w, h);
  if (!item) return { ok: false, cells, reason: 'not-accepted' };
  const v = view(ref);
  if (ref.kind === 'panel') {
    if (ref.in === id) return { ok: false, cells, reason: 'self' };
    if (ancestorsOf(inv, ref.in).includes(id)) return { ok: false, cells, reason: 'cycle' };
    if (stashOnly(item)) return { ok: false, cells, reason: 'not-accepted' }; // furniture never nests
  }
  if (x < 0 || y < 0 || x + w > v.width || (!isGrowing(ref) && y + h > v.height)) return { ok: false, cells, reason: 'out-of-bounds' };
  if (!acceptsItem(v.accepts, item) || !regionsAccept(v.regions, item, x, y, w, h)) return { ok: false, cells, reason: 'not-accepted' };
  const occ = occupancy(v, id);
  if (cells.some(([cx, cy]) => occ.has(`${cx},${cy}`))) return { ok: false, cells, reason: 'occupied' };
  return { ok: true, cells };
}

/** The item in a slot of the active loadout, if any. */
export function slotOccupant(inv: Inventory, slot: string): string | null {
  const lo = inv.loadouts[inv.activeLoadout];
  if (!lo) return null;
  for (const [id, p] of Object.entries(lo.placements)) {
    if (p.kind === 'slot' && p.slot === slot && inv.items[id] && !inv.items[id].attachedTo) return id;
  }
  return null;
}

/**
 * The one stack a grid drop of `id` would land on, when every occupied cell under it belongs to a single item that is
 * the same product as `id` and is not locked. Null otherwise.
 */
function mergeTarget(inv: Inventory, id: string, ref: GridRef, cells: Cell[], view: ViewFn): string | null {
  const occ = occupancy(view(ref), id);
  const under = new Set<string>();
  for (const [cx, cy] of cells) { const o = occ.get(`${cx},${cy}`); if (o) under.add(o); }
  if (under.size !== 1) return null;
  const [other] = under;
  const o = inv.items[other];
  return o && !o.locked && sameProduct(inv.items[id], o) ? other : null;
}

/** Can `id` go on `target`? Returns the covered cells for the green/red highlight (none for slot/quickUse). */
export function canFit(inv: Inventory, id: string, target: DropTarget, view: ViewFn = (r) => gridView(inv, r)): FitResult {
  const item = inv.items[id];
  if (item?.locked && target.kind !== 'quickUse') {
    // A locked item stays where it is. (A Quick Use pin is a reference, not a move, so it is still allowed.)
    if (target.kind !== 'grid') return { ok: false, cells: [], reason: 'locked' };
    const [w, h] = footprintOf(item, target.rotated);
    return { ok: false, cells: cellsOf(target.x, target.y, w, h), reason: 'locked' };
  }
  if (target.kind === 'quickUse') {
    // A Quick Use pin is a reference, not a move: anything goes in any of the 10 boxes.
    const ok = !!item && target.index >= 0 && target.index < 10;
    return ok ? { ok, cells: [] } : { ok, cells: [], reason: 'not-accepted' };
  }
  if (target.kind === 'slot') {
    const lo = inv.loadouts[inv.activeLoadout];
    if (!item || !lo || !lo.slots.includes(target.slot) || target.slot === POCKETS_PANEL) return { ok: false, cells: [], reason: 'not-accepted' };
    if (!slotAccepts(target.slot, item)) return { ok: false, cells: [], reason: 'not-accepted' };
    const occ = slotOccupant(inv, target.slot);
    if (occ && occ !== id) return { ok: false, cells: [], reason: 'occupied' };
    return { ok: true, cells: [] };
  }
  const fit = fitAt(inv, id, target.grid, target.x, target.y, target.rotated, view);
  if (fit.reason === 'occupied') {
    const merge = mergeTarget(inv, id, target.grid, fit.cells, view);
    if (merge) return { ok: true, cells: fit.cells, merge };
  }
  return fit;
}
