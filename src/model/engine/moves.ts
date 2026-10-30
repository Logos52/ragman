/**
 * Item mutations at the engine level. Every function MUTATES the inventory passed in (the store passes a clone)
 * and returns false when nothing should change (the store then skips the undo step and the save).
 *
 * Where a grid drop is written:
 *   stash / archive                         -> item.home (and the active loadout's placement is removed)
 *   pockets, or a panel of a carried bag     -> a placement in the active loadout (home untouched)
 *   a panel of a container sitting in a stash -> item.home of kind panel (placement removed)
 * Archive in/out: a drop into the Archive sets status 'Not Worn'; an archived item dropped anywhere outside the Archive
 * (a slot, the pockets, a panel, a stash) gets status '' and, if its home was in the Archive, a home in its stash.
 *
 * Locked: a locked item is never moved, equipped, archived, unarchived, sent to the stash, deleted, merged or split
 * (canFit says 'locked'; the other moves return false). Deleting a container is refused while one of the items it
 * would move out (its direct contents and its attachments) is locked. A locked item inside a container still travels
 * with the container. Quick Use pins and flag edits (pin, lock, verify, nickname) are allowed.
 */
import type { DropTarget, FitResult, GridRef, Inventory, Item, ItemPatch, SplitResult } from '../types';
import { buildLinks, effectivePlace, gridBuckets, gridOfPlace, gridView, isCarried, isContainer, isGrowing, rootPlace } from './place';
import { acceptsItem, canFit, fitAt } from './fit';
import { autoPlace } from './firstFree';
import { equipOrder, stashOnly } from './slotRules';
import { clearPlacement, homeFromRef, placementFromRef, rehomeFirstFree, stashRefFor } from './ops';
import { NOT_WORN } from './normalize';
import { quantityOf, sameProduct, splitId } from './stacks';

const isArchived = (item: Item) => item.status === NOT_WORN || item.home?.kind === 'archive';

/** Detach an attachment that is being moved on its own; it needs a home so other loadouts can still find it. */
function detach(inv: Inventory, id: string, stashLocation: string): void {
  const item = inv.items[id];
  if (!item.attachedTo) return;
  item.attachedTo = null;
  if (!item.home) rehomeFirstFree(inv, id, stashRefFor(inv, id, stashLocation));
}

/** Pin (or unpin) a Quick Use box. Ids only; an item is pinned in at most one box. */
export function setQuickUse(inv: Inventory, index: number, id: string | null): boolean {
  if (index < 0 || index >= 10) return false;
  if (id) inv.quickUse = inv.quickUse.map((q) => (q === id ? null : q));
  inv.quickUse[index] = id;
  return true;
}

/** The drag/drop. Checks the fit first; returns false (no change) when it does not fit. A drop onto an identical stack merges. */
export function moveItem(inv: Inventory, id: string, target: DropTarget, stashLocation: string): boolean {
  const fit = canFit(inv, id, target);
  if (!fit.ok) return false;
  if (fit.merge) return mergeStacks(inv, id, fit.merge, stashLocation);
  if (target.kind === 'quickUse') return setQuickUse(inv, target.index, id);
  const item = inv.items[id];
  const wasArchived = isArchived(item);
  detach(inv, id, stashLocation);
  const lo = inv.loadouts[inv.activeLoadout];
  if (target.kind === 'slot') {
    lo.placements[id] = { kind: 'slot', slot: target.slot };
  } else {
    const { grid: ref, x, y, rotated } = target;
    const toLoadout = ref.kind === 'pockets' || (ref.kind === 'panel' && isCarried(inv, ref.in));
    if (toLoadout) {
      lo.placements[id] = placementFromRef(ref, x, y, rotated)!;
    } else {
      item.home = homeFromRef(ref, x, y, rotated);
      clearPlacement(inv, id);
      if (ref.kind === 'stash') item.location = ref.location; // dropping in a stash means it now lives at that location
    }
    if (ref.kind === 'archive') { item.status = NOT_WORN; return true; }
  }
  // Dragged out of the Archive by any route (a slot, the pockets, a bag, a panel, a stash): the status clears, and a
  // home still in the Archive moves to the location's stash. A drop into a container that sits in the Archive stays archived.
  if (wasArchived && rootPlace(inv, id)?.kind !== 'archive') {
    item.status = '';
    if (item.home?.kind === 'archive') rehomeFirstFree(inv, id, stashRefFor(inv, id, stashLocation));
  }
  return true;
}

/** Ctrl-click: first free cells of the item's location stash (else the current stash). */
export function sendToStash(inv: Inventory, id: string, stashLocation: string): boolean {
  const item = inv.items[id];
  if (!item || item.locked) return false;
  const ref = stashRefFor(inv, id, stashLocation);
  const now = effectivePlace(inv, id);
  if (!item.attachedTo && now?.kind === 'stash' && ref.kind === 'stash' && now.location === ref.location) return false;
  clearPlacement(inv, id);
  const wasArchived = isArchived(item);
  if (!rehomeFirstFree(inv, id, ref)) return false;
  if (wasArchived) item.status = '';
  return true;
}

/** Mark Not Worn and move to the Archive's first free cells. Archived items leave every loadout. */
export function archiveItem(inv: Inventory, id: string): boolean {
  const item = inv.items[id];
  if (!item || item.locked) return false;
  item.status = NOT_WORN;
  clearPlacement(inv, id, 'all');
  if (item.home?.kind === 'archive' && !item.attachedTo) return true;
  return rehomeFirstFree(inv, id, { kind: 'archive' });
}

/** Clear the status and return to the location's stash, or move to `target`. */
export function unarchiveItem(inv: Inventory, id: string, stashLocation: string, target?: DropTarget): boolean {
  const item = inv.items[id];
  if (!item || item.locked) return false;
  if (target) {
    if (target.kind === 'grid' && target.grid.kind === 'archive') return false;
    if (!moveItem(inv, id, target, stashLocation)) return false;
    if (item.status === NOT_WORN) item.status = '';
    if (item.home?.kind === 'archive') rehomeFirstFree(inv, id, stashRefFor(inv, id, stashLocation));
    return true;
  }
  item.status = '';
  return rehomeFirstFree(inv, id, stashRefFor(inv, id, stashLocation));
}

/**
 * After a footprint change, in every loadout (the active one first): if the item no longer fits where that loadout
 * draws it, re-place it in the same grid. A loadout placement that cannot be re-placed is dropped, so the item falls
 * back to its home there (which is then checked the same way); a home that cannot be re-placed goes to the stash.
 */
export function refit(inv: Inventory, id: string, stashLocation: string): void {
  if (!inv.items[id] || inv.items[id].attachedTo) return;
  const names = [inv.activeLoadout, ...Object.keys(inv.loadouts).filter((n) => n !== inv.activeLoadout)];
  for (const name of names) refitIn(inv, id, name, stashLocation);
}

function refitIn(inv: Inventory, id: string, loadout: string, stashLocation: string): void {
  for (let pass = 0; pass < 2; pass++) {
    const place = effectivePlace(inv, id, loadout);
    const ref = gridOfPlace(place);
    if (!place || !ref || place.kind === 'slot') return;
    const buckets = gridBuckets(inv, loadout);
    const view = (r: GridRef) => gridView(inv, r, buckets, loadout);
    if (fitAt(inv, id, ref, place.x, place.y, place.rotated, view).ok) return;
    if (isGrowing(ref)) { rehomeFirstFree(inv, id, ref, loadout); return; } // stash/archive: always a home
    const spot = autoPlace(view(ref), id, inv.items[id]);
    if (spot) { place.x = spot.x; place.y = spot.y; place.rotated = spot.rotated; return; }
    const lo = inv.loadouts[loadout];
    if (lo?.placements[id] === place) { delete lo.placements[id]; continue; } // fall back to the home, check it next
    rehomeFirstFree(inv, id, stashRefFor(inv, id, stashLocation), loadout);
    return;
  }
}

/**
 * Edit form. `hidden` is never taken from a patch (the file keeps whatever it had); nor are `home`, `panels` and
 * `attachedTo`, which only change through the checked moves (fit, overlap and cycle rules). Stripped at run time too,
 * so an untyped caller (a script, the dev console) cannot write them unchecked.
 * Status to Not Worn archives the item; status away from Not Worn brings an archived item back to its stash.
 * A location change moves a stash-homed item to the new location's stash. A footprint change re-fits.
 * Refused (false, nothing changes): a nickname on an item that is not a container; a quantity that is not an integer
 * >= 1 or on an item that is not consumable; on a locked item, a status change into or out of Not Worn or a location
 * change of a stash-homed item (both would move it). `quantity: undefined` or `nickname: ''` removes the field.
 */
export function updateItem(inv: Inventory, id: string, patch: ItemPatch, stashLocation: string): boolean {
  const item = inv.items[id];
  if (!item) return false;
  const { hidden: _h, home: _ho, panels: _p, attachedTo: _a, ...p } = patch as Partial<Item>;
  void _h; void _ho; void _p; void _a;
  if ('nickname' in p && p.nickname && !isContainer(item)) return false;
  if ('quantity' in p && p.quantity !== undefined) {
    const consumable = 'consumable' in p ? p.consumable : item.consumable;
    if (!Number.isInteger(p.quantity) || (p.quantity as number) < 1 || !consumable) return false;
  }
  if (item.locked) {
    const archives = 'status' in p && p.status !== item.status && (p.status === NOT_WORN || item.status === NOT_WORN);
    const relocates = 'location' in p && p.location !== item.location && item.home?.kind === 'stash' && !!p.location;
    if (archives || relocates) return false;
  }
  const prevStatus = item.status, prevLocation = item.location;
  Object.assign(item, p);
  if ('quantity' in p && p.quantity === undefined) delete item.quantity;
  if (('weightEstimated' in p && !p.weightEstimated) || item.weight_g == null) delete item.weightEstimated; // a blank weight is unweighed, not estimated
  if ('nickname' in p && !p.nickname) delete item.nickname;
  if ('status' in p && p.status !== prevStatus) {
    if (p.status === NOT_WORN) archiveItem(inv, id);
    else if (prevStatus === NOT_WORN && item.home?.kind === 'archive') rehomeFirstFree(inv, id, stashRefFor(inv, id, stashLocation));
  }
  if ('location' in p && p.location !== prevLocation && item.home?.kind === 'stash' && p.location) {
    rehomeFirstFree(inv, id, { kind: 'stash', location: p.location });
  }
  if ('footprint' in p) refit(inv, id, stashLocation);
  return true;
}

/** New item: lands at the first free cells of the current stash (its footprint, 1x1 when blank). */
export function addItem(inv: Inventory, id: string, item: Item, stashLocation: string): boolean {
  if (inv.items[id]) return false;
  const copy = structuredClone(item);
  if (!copy.location) copy.location = stashLocation;
  copy.home = null;
  inv.items[id] = copy;
  const ref: GridRef = copy.status === NOT_WORN ? { kind: 'archive' } : { kind: 'stash', location: stashLocation };
  return rehomeFirstFree(inv, id, ref);
}

/**
 * Delete (PRD: "removes its placements, its attachments' links, and its Quick Use pin").
 * Its contents go to their stash (first free cells). Its attachments survive, detached: each gets a home at the
 * first free cells of its location's stash (the Archive when it is Not Worn). Its Quick Use pins and loadout
 * placements go. Task auto objectives that name it stay (they never tick).
 */
export function deleteItem(inv: Inventory, id: string, stashLocation: string): boolean {
  if (!inv.items[id] || inv.items[id].locked) return false;
  const attachments = (buildLinks(inv).attachments.get(id) ?? []).map((a) => a.item);
  // Everything inside it, in any loadout.
  const inside = new Set<string>();
  for (const [cid, c] of Object.entries(inv.items)) if (c.home?.kind === 'panel' && c.home.in === id) inside.add(cid);
  for (const lo of Object.values(inv.loadouts)) {
    for (const [cid, p] of Object.entries(lo.placements)) if (p.kind === 'panel' && p.in === id) inside.add(cid);
  }
  if ([...inside, ...attachments].some((cid) => inv.items[cid]?.locked)) return false; // they would have to move
  for (const lo of Object.values(inv.loadouts)) {
    for (const [cid, p] of Object.entries(lo.placements)) {
      if (p.kind === 'panel' && p.in === id) { delete lo.placements[cid]; inside.add(cid); }
    }
    delete lo.placements[id];
  }
  inv.quickUse = inv.quickUse.map((q) => (q === id ? null : q));
  delete inv.items[id];
  for (const cid of inside) {
    const c = inv.items[cid];
    if (c && (!c.home || (c.home.kind === 'panel' && c.home.in === id))) rehomeFirstFree(inv, cid, stashRefFor(inv, cid, stashLocation));
  }
  for (const aid of attachments) {
    const a = inv.items[aid];
    a.attachedTo = null;
    rehomeFirstFree(inv, aid, a.status === NOT_WORN ? { kind: 'archive' } : stashRefFor(inv, aid, stashLocation));
  }
  return true;
}

/** Equip: an explicit slot, else the first slot of the active loadout that is empty and where canFit is ok
 * (Pockets is never a slot target; Backpack/Carry-on/Pouch take only containers). */
export function equipItem(inv: Inventory, id: string, stashLocation: string, slot?: string): boolean {
  const lo = inv.loadouts[inv.activeLoadout];
  if (!lo || !inv.items[id]) return false;
  const candidates = slot ? [slot] : equipOrder(inv, inv.items[id]);
  for (const s of candidates) {
    const t: DropTarget = { kind: 'slot', slot: s };
    if (canFit(inv, id, t).ok) return moveItem(inv, id, t, stashLocation); // canFit already says 'occupied' for a taken slot
  }
  return false;
}

/* ---------------- flags ---------------- */

type Flag = 'pinned' | 'locked' | 'verified';

/** true writes the flag; false removes the key (absent means false), so the file only carries flags that are set. */
function setFlag(inv: Inventory, id: string, key: Flag, on: boolean): boolean {
  const item = inv.items[id];
  if (!item || !!item[key] === on) return false;
  if (on) item[key] = true; else delete item[key];
  return true;
}

/** Pin: Sort leaves the item where it is. */
export const setPinned = (inv: Inventory, id: string, on: boolean) => setFlag(inv, id, 'pinned', on);
/** Lock: the item cannot be moved, equipped, archived, deleted, merged or split until unlocked. */
export const setLocked = (inv: Inventory, id: string, on: boolean) => setFlag(inv, id, 'locked', on);
/** Verified: the owner ticked it on the card; unverified draws a "?" mark. */
export const setVerified = (inv: Inventory, id: string, on: boolean) => setFlag(inv, id, 'verified', on);

/** Containers only. A blank (or whitespace) nickname removes the field. Stored trimmed. */
export function setNickname(inv: Inventory, id: string, nickname: string | null): boolean {
  const item = inv.items[id];
  if (!item || !isContainer(item)) return false;
  const v = (nickname ?? '').trim();
  if (!v) { if (!('nickname' in item)) return false; delete item.nickname; return true; }
  if (item.nickname === v) return false;
  item.nickname = v;
  return true;
}

/* ---------------- stacks ---------------- */

/**
 * Merge stack `source` into stack `target` (same product, both consumable, neither locked, not the same item):
 * target.quantity becomes the sum and `source` is deleted. Quick Use pins, task item links and auto objectives that
 * named `source` now name `target` (a pin already on `target` stays the only one).
 */
export function mergeStacks(inv: Inventory, source: string, target: string, stashLocation: string): boolean {
  const a = inv.items[source], b = inv.items[target];
  if (!a || !b || source === target || a.locked || b.locked || !sameProduct(a, b)) return false;
  b.quantity = quantityOf(a) + quantityOf(b);
  const pinned = inv.quickUse.includes(target);
  inv.quickUse = inv.quickUse.map((q) => (q === source ? (pinned ? null : target) : q));
  for (const t of inv.tasks) {
    if (t.itemId === source) t.itemId = target;
    for (const o of t.objectives) if (o.auto?.item === source) o.auto.item = target;
  }
  return deleteItem(inv, source, stashLocation);
}

/**
 * Split `n` off stack `id` (1 <= n < quantity) into a new item `<id>-<k>` (the first free k from 2) placed at
 * `target`. With no target it goes to the first free cells of the grid the stack is drawn in, else its location's
 * stash. A target that is an identical stack merges the n into it (the answer's id is then that stack). A target that
 * is not a home (the pockets, a carried bag, a slot) also gives the new stack a home in its stash, as every item has one.
 * The copy keeps everything about the product (verified, notes, images, hidden) but is not pinned.
 * On a bad n, a locked or non-consumable stack, or a target that does not fit, nothing changes.
 */
export function splitStack(inv: Inventory, id: string, n: number, stashLocation: string, target?: DropTarget): SplitResult {
  const item = inv.items[id];
  const fail = (reason: FitResult['reason']): SplitResult => ({ ok: false, cells: [], reason });
  if (!item || !item.consumable) return fail('not-accepted');
  if (item.locked) return fail('locked');
  const q = quantityOf(item);
  if (!Number.isInteger(n) || n < 1 || n >= q) return fail('not-accepted');
  if (target?.kind === 'quickUse') return fail('not-accepted');
  const newId = splitId(inv, id);
  const copy = structuredClone(item);
  delete copy.pinned;
  copy.quantity = n;
  copy.home = null;
  copy.attachedTo = null;
  inv.items[newId] = copy;
  item.quantity = q - n;
  const undo = (r: FitResult): SplitResult => { delete inv.items[newId]; item.quantity = q; return { ...r, id: undefined }; };

  let t = target;
  if (!t) {
    const ref = gridOfPlace(effectivePlace(inv, id));
    const spot = ref ? autoPlace(gridView(inv, ref), newId, copy) : null;
    if (ref && spot) t = { kind: 'grid', grid: ref, ...spot };
  }
  if (!t) {
    if (!rehomeFirstFree(inv, newId, stashRefFor(inv, newId, stashLocation))) return undo(fail('occupied'));
    return { ok: true, cells: [], id: newId };
  }
  const fit = canFit(inv, newId, t);
  if (!fit.ok) return undo(fit);
  if (fit.merge === id) return undo({ ok: false, cells: fit.cells, reason: 'occupied' }); // back onto itself
  if (fit.merge) {
    mergeStacks(inv, newId, fit.merge, stashLocation);
    return { ...fit, id: fit.merge };
  }
  moveItem(inv, newId, t, stashLocation);
  const made = inv.items[newId];
  if (!made.home && !made.attachedTo) rehomeFirstFree(inv, newId, stashRefFor(inv, newId, stashLocation));
  return { ...fit, id: newId };
}

/* ---------------- quick move ---------------- */

/**
 * Quick move into a container: the first free cells of its first panel (in panel order) that accepts the item, as
 * the active loadout draws it, through the same checked move as a drop. The reason when nothing fits: 'locked',
 * 'self'/'cycle', 'occupied' (a panel accepts it but is full) or 'not-accepted' (no panel accepts it).
 */
export function quickMoveInto(inv: Inventory, id: string, containerId: string, stashLocation: string): FitResult {
  const item = inv.items[id];
  const container = inv.items[containerId];
  if (!item || !container || !isContainer(container)) return { ok: false, cells: [], reason: 'not-accepted' };
  if (item.locked) return { ok: false, cells: [], reason: 'locked' };
  let reason: FitResult['reason'] = 'not-accepted';
  for (const panel of container.panels!) {
    const ref: GridRef = { kind: 'panel', in: containerId, panel: panel.name };
    const view = gridView(inv, ref);
    if (stashOnly(item) || !acceptsItem(view.accepts, item)) continue;
    const spot = autoPlace(view, id, item);
    if (!spot) { reason = 'occupied'; continue; }
    const t: DropTarget = { kind: 'grid', grid: ref, ...spot };
    const fit = canFit(inv, id, t);
    if (!fit.ok) {
      if (fit.reason === 'self' || fit.reason === 'cycle') return fit;
      reason = fit.reason;
      continue;
    }
    moveItem(inv, id, t, stashLocation);
    return fit;
  }
  return { ok: false, cells: [], reason };
}
