/**
 * Structure edits the owner makes in the tool: a container's panels (grid, accepts, reserved regions), the active
 * loadout's slot list and pockets grid, and attachments (attach / detach, the watch band swap).
 * Every function MUTATES the inventory passed in (the store passes a clone) and returns false when nothing changes.
 *
 * Panels. setPanels replaces a container's panel list. `from[i]` names the panel that panels[i] was before the edit
 * (null for a new panel), so a rename carries its contents along; contents of a panel that is gone, or that no longer
 * fits or accepts them, are re-placed by the same rule as a footprint edit (refit): first free cells of the same
 * grid, else the loadout placement is dropped and the home is checked, else the home goes to the stash.
 * Refused (nothing changes): an empty list, a blank or duplicate name, a grid or region that is not whole cells >= 1,
 * a region outside its panel, or an edit that would have to move a locked item.
 *
 * Loadout. setLoadoutSlots / setPocketsGrid act on the active loadout (the one on screen). An item placed in a slot
 * that is removed, or in the pockets when the Pockets slot is removed, goes back to its home; a pockets placement that
 * no longer fits the new grid is re-placed in the pockets, else it goes home. Locked items are never moved: an edit
 * that would move one is refused.
 *
 * Attachments. A slot named in a parent's `attachmentSlots` takes an item whose tags or category include the slot
 * name (the band slot takes items tagged band). attach() drops the item's home and placements (an attached item
 * goes where its parent goes); an item already in that slot is detached first (a swap) and gets a home in its stash.
 * detach() gives the item a home at the first free cells of its location's stash (the Archive when Not Worn).
 */
import type { Cells, Inventory, Item, Panel, Region } from '../types';
import { ancestorsOf, POCKETS_ID, POCKETS_PANEL } from './place';
import { acceptsItem } from './fit';
import { refit } from './moves';
import { clearPlacement, rehomeFirstFree, stashRefFor } from './ops';
import { NOT_WORN } from './normalize';
import { settleLoadout } from './loadout';

const MAX_CELLS = 40;
const isCells = (c: unknown): c is Cells =>
  Array.isArray(c) && c.length === 2 && c.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_CELLS);
const isAt = (c: unknown): boolean => Array.isArray(c) && c.length === 2 && c.every((n) => Number.isInteger(n) && n >= 0);
const cleanList = (l: unknown): string[] =>
  Array.isArray(l) ? [...new Set(l.map((s) => String(s).trim()).filter(Boolean))] : [];

/** Every item's place in every loadout, as JSON, for the locked-item check. */
function placesOf(inv: Inventory, ids: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of ids) {
    const it = inv.items[id];
    const lp = Object.entries(inv.loadouts).map(([n, lo]) => `${n}:${JSON.stringify(lo.placements[id] ?? null)}`).join('|');
    out.set(id, `${JSON.stringify(it?.home ?? null)}|${JSON.stringify(it?.attachedTo ?? null)}|${lp}`);
  }
  return out;
}
const lockedIds = (inv: Inventory) => Object.keys(inv.items).filter((id) => inv.items[id].locked);
function lockedMoved(inv: Inventory, before: Map<string, string>): boolean {
  const after = placesOf(inv, [...before.keys()]);
  return [...before].some(([id, v]) => after.get(id) !== v);
}

/** A clean copy of a panel list, or null when it is not valid (see the header). */
export function cleanPanels(panels: Panel[]): Panel[] | null {
  if (!Array.isArray(panels) || panels.length === 0) return null;
  const names = new Set<string>();
  const out: Panel[] = [];
  for (const p of panels) {
    const name = String(p?.name ?? '').trim();
    if (!name || names.has(name) || !isCells(p.grid)) return null;
    names.add(name);
    const accepts = p.accepts == null ? null : cleanList(p.accepts);
    const regions: Region[] = [];
    const rnames = new Set<string>();
    for (const r of p.regions ?? []) {
      const rname = String(r?.name ?? '').trim();
      if (!rname || rnames.has(rname) || !isAt(r.at) || !isCells(r.size)) return null;
      if (r.at[0] + r.size[0] > p.grid[0] || r.at[1] + r.size[1] > p.grid[1]) return null;
      rnames.add(rname);
      regions.push({ name: rname, at: [r.at[0], r.at[1]], size: [r.size[0], r.size[1]], accepts: cleanList(r.accepts) });
    }
    out.push({ name, grid: [p.grid[0], p.grid[1]], accepts: accepts && accepts.length ? accepts : null, regions });
  }
  return out;
}

/** Replace a container's panels (see the header). `from[i]`: the old name of panels[i], null when it is new. */
export function setPanels(inv: Inventory, id: string, panels: Panel[], from: (string | null)[] = [], stashLocation = ''): boolean {
  const item = inv.items[id];
  const clean = cleanPanels(panels);
  if (!item || !clean) return false;
  if (JSON.stringify(item.panels ?? null) === JSON.stringify(clean)) return false;
  const rename = new Map<string, string>();
  clean.forEach((p, i) => { const old = from[i]; if (old && old !== p.name) rename.set(old, p.name); });
  const locked = placesOf(inv, lockedIds(inv));

  // who lives in this container, in any loadout (home or placement)
  const inside = new Set<string>();
  for (const [cid, c] of Object.entries(inv.items)) {
    if (c.home?.kind === 'panel' && c.home.in === id) { inside.add(cid); const n = rename.get(c.home.panel); if (n) c.home.panel = n; }
  }
  for (const lo of Object.values(inv.loadouts)) {
    for (const [cid, p] of Object.entries(lo.placements)) {
      if (p.kind === 'panel' && p.in === id) { inside.add(cid); const n = rename.get(p.panel); if (n) p.panel = n; }
    }
  }
  item.panels = clean;
  for (const cid of inside) refit(inv, cid, stashLocation);
  return !lockedMoved(inv, locked);
}

/** Does `slot` of an attachment parent take `item`? Its tags or category must include the slot name. */
export function attachAccepts(slot: string, item: Item): boolean {
  return acceptsItem([slot], item);
}

/** The item attached to `parent` in `slot`, if any. */
export function attachedIn(inv: Inventory, parent: string, slot: string): string | null {
  for (const [id, it] of Object.entries(inv.items)) if (it.attachedTo?.to === parent && it.attachedTo.slot === slot) return id;
  return null;
}

/** Why `id` cannot go on `parent`'s `slot`, or null when it can (an occupied slot is a swap, not a refusal). */
export function attachRefusal(inv: Inventory, id: string, parent: string, slot: string): 'locked' | 'self' | 'cycle' | 'not-accepted' | null {
  const item = inv.items[id], p = inv.items[parent];
  if (!item || !p || !(p.attachmentSlots ?? []).includes(slot)) return 'not-accepted';
  if (id === parent) return 'self';
  if (item.locked) return 'locked';
  if (item.attachedTo?.to === parent && item.attachedTo.slot === slot) return 'not-accepted'; // already there
  if (ancestorsOf(inv, parent).includes(id)) return 'cycle';
  for (const lo of Object.keys(inv.loadouts)) if (ancestorsOf(inv, parent, lo).includes(id)) return 'cycle';
  if (!attachAccepts(slot, item)) return 'not-accepted';
  const occ = attachedIn(inv, parent, slot);
  if (occ && inv.items[occ].locked) return 'locked';
  return null;
}

/** Give a detached item a home: first free cells of its stash, the Archive when Not Worn. */
function homeDetached(inv: Inventory, id: string, stashLocation: string): boolean {
  const it = inv.items[id];
  it.attachedTo = null;
  return rehomeFirstFree(inv, id, it.status === NOT_WORN ? { kind: 'archive' } : stashRefFor(inv, id, stashLocation));
}

/** Attach `id` to `parent` in `slot` (a swap when the slot is taken). */
export function attach(inv: Inventory, id: string, parent: string, slot: string, stashLocation: string): boolean {
  if (attachRefusal(inv, id, parent, slot)) return false;
  const occ = attachedIn(inv, parent, slot);
  if (occ && !homeDetached(inv, occ, stashLocation)) return false;
  const item = inv.items[id];
  clearPlacement(inv, id, 'all');
  item.home = null;
  item.attachedTo = { to: parent, slot };
  // An archived band put on a watch that is not in the Archive is in use again.
  if (item.status === NOT_WORN && inv.items[parent].status !== NOT_WORN) item.status = '';
  return true;
}

/** Take an attached item off its parent; it lands in its stash (the Archive when Not Worn). */
export function detach(inv: Inventory, id: string, stashLocation: string): boolean {
  const item = inv.items[id];
  if (!item || !item.attachedTo || item.locked) return false;
  return homeDetached(inv, id, stashLocation);
}

/* ---------------- the active loadout ---------------- */

/** Replace the active loadout's slot list (trimmed, blank and duplicate names dropped). */
export function setLoadoutSlots(inv: Inventory, slots: string[]): boolean {
  const lo = inv.loadouts[inv.activeLoadout];
  if (!lo) return false;
  const next = cleanList(slots);
  if (JSON.stringify(next) === JSON.stringify(lo.slots)) return false;
  const locked = placesOf(inv, lockedIds(inv));
  const removed = lo.slots.filter((s) => !next.includes(s));
  const leaving: string[] = [];
  for (const [id, p] of Object.entries(lo.placements)) {
    const gone = p.kind === 'slot' ? removed.includes(p.slot) : p.in === POCKETS_ID && removed.includes(POCKETS_PANEL);
    if (gone) { delete lo.placements[id]; leaving.push(id); }
  }
  lo.slots = next;
  settleLoadout(inv, leaving);
  return !lockedMoved(inv, locked);
}

/** Resize the active loadout's pockets grid (whole cells, 1 to 40 each way). */
export function setPocketsGrid(inv: Inventory, grid: Cells): boolean {
  const lo = inv.loadouts[inv.activeLoadout];
  if (!lo || !isCells(grid)) return false;
  const cur = lo.pocketsGrid ?? [4, 1];
  if (cur[0] === grid[0] && cur[1] === grid[1]) return false;
  const locked = placesOf(inv, lockedIds(inv));
  lo.pocketsGrid = [grid[0], grid[1]];
  settleLoadout(inv, []);
  return !lockedMoved(inv, locked);
}

