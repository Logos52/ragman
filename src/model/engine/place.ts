/**
 * Placement: where an item is drawn right now, and the grids derived from that.
 * Pure functions over an Inventory. No React, no zustand.
 *
 * Pockets: the pockets grid is not an item, so it has no container id. A pockets placement is stored
 * in a loadout's `placements` as a PanelPlace on a virtual container:
 *   { kind: 'panel', in: POCKETS_ID ('__pockets__'), panel: 'Pockets', x, y, rotated }
 * The UI never sees this; it only uses GridRef { kind: 'pockets' }. gridOfPlace() maps one to the other.
 */
import type { Cells, GridItemView, GridRef, GridView, Inventory, Item, Loadout, Place, Region } from '../types';

export const POCKETS_ID = '__pockets__';
export const POCKETS_PANEL = 'Pockets';
/** Stash/Archive draw at least this many rows, and always this many empty rows below the lowest item. */
export const MIN_ROWS = 12;
export const PAD_ROWS = 4;

export function loadoutOf(inv: Inventory, name: string = inv.activeLoadout): Loadout | undefined {
  return inv.loadouts[name];
}

/** Footprint after rotation; a blank (null/missing/bad) footprint is 1x1. */
export function footprintOf(item: Item | undefined, rotated = false): Cells {
  const fp = item?.footprint;
  const w = fp && fp[0] >= 1 ? fp[0] : 1;
  const h = fp && fp[1] >= 1 ? fp[1] : 1;
  return rotated ? [h, w] : [w, h];
}

export function isContainer(item: Item | undefined): boolean {
  return !!item?.panels && item.panels.length > 0;
}

/**
 * The loadout placement if it is usable, else the home. An attached item resolves to its parent's place.
 * A slot placement whose slot is not in the loadout's slot list (or a pockets placement in a loadout
 * without a Pockets slot) is ignored, so the item falls back to its home.
 */
export function effectivePlace(inv: Inventory, id: string, loadout: string = inv.activeLoadout, seen?: Set<string>): Place | null {
  const item = inv.items[id];
  if (!item) return null;
  if (item.attachedTo) {
    const s = seen ?? new Set<string>();
    if (s.has(id)) return null; // attachment cycle in bad data
    s.add(id);
    return effectivePlace(inv, item.attachedTo.to, loadout, s);
  }
  const lo = inv.loadouts[loadout];
  const p = lo?.placements[id];
  if (p) {
    if (p.kind === 'slot') { if (lo.slots.includes(p.slot)) return p; }
    else if (p.in !== POCKETS_ID || lo.slots.includes(POCKETS_PANEL)) return p;
  }
  return item.home ?? null;
}

/** The grid a place belongs to; null for slots. */
export function gridOfPlace(p: Place | null): GridRef | null {
  if (!p) return null;
  switch (p.kind) {
    case 'stash': return { kind: 'stash', location: p.location };
    case 'archive': return { kind: 'archive' };
    case 'panel': return p.in === POCKETS_ID ? { kind: 'pockets' } : { kind: 'panel', in: p.in, panel: p.panel };
    default: return null;
  }
}

/** Stable string key for a grid, used for caches and buckets. */
export function refKey(ref: GridRef): string {
  switch (ref.kind) {
    case 'stash': return `stash:${ref.location}`;
    case 'archive': return 'archive';
    case 'pockets': return 'pockets';
    case 'panel': return `panel:${ref.in}/${ref.panel}`;
  }
}

/** Stash and Archive grow downward without limit; panels and pockets are fixed. */
export function isGrowing(ref: GridRef): boolean {
  return ref.kind === 'stash' || ref.kind === 'archive';
}

/** The direct parent container (or the item an attachment hangs on), in the given loadout. */
export function parentOf(inv: Inventory, id: string, loadout: string = inv.activeLoadout): string | null {
  const item = inv.items[id];
  if (!item) return null;
  if (item.attachedTo) return item.attachedTo.to;
  const p = effectivePlace(inv, id, loadout);
  return p && p.kind === 'panel' && p.in !== POCKETS_ID ? p.in : null;
}

/** Every container (or attachment parent) above an item, nearest first. Loop-safe. */
export function ancestorsOf(inv: Inventory, id: string, loadout: string = inv.activeLoadout): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  let cur = parentOf(inv, id, loadout);
  while (cur && !seen.has(cur)) { out.push(cur); seen.add(cur); cur = parentOf(inv, cur, loadout); }
  return out;
}

/** The outermost place in an item's chain: a slot, the pockets, a stash or the archive. */
export function rootPlace(inv: Inventory, id: string, loadout: string = inv.activeLoadout): Place | null {
  const anc = ancestorsOf(inv, id, loadout);
  return effectivePlace(inv, anc.length ? anc[anc.length - 1] : id, loadout);
}

/** True when the item is on the person in the loadout: in a slot or the pockets, at any depth. */
export function isCarried(inv: Inventory, id: string, loadout: string = inv.activeLoadout): boolean {
  const r = rootPlace(inv, id, loadout);
  return !!r && (r.kind === 'slot' || (r.kind === 'panel' && r.in === POCKETS_ID));
}

/** Parent -> children (panel contents) and parent -> attachments, for one loadout. */
export interface Links { children: Map<string, string[]>; attachments: Map<string, { slot: string; item: string }[]> }

export function buildLinks(inv: Inventory, loadout: string = inv.activeLoadout): Links {
  const children = new Map<string, string[]>();
  const attachments = new Map<string, { slot: string; item: string }[]>();
  for (const id of Object.keys(inv.items)) {
    const item = inv.items[id];
    if (item.attachedTo) {
      const list = attachments.get(item.attachedTo.to) ?? [];
      list.push({ slot: item.attachedTo.slot, item: id });
      attachments.set(item.attachedTo.to, list);
      continue;
    }
    const p = effectivePlace(inv, id, loadout);
    if (p && p.kind === 'panel' && p.in !== POCKETS_ID) {
      const list = children.get(p.in) ?? [];
      list.push(id);
      children.set(p.in, list);
    }
  }
  return { children, attachments };
}

/** Panel contents of a container; with deep, everything below it (attachments not included). */
export function contentsOf(links: Links, containerId: string, deep = false): string[] {
  const direct = links.children.get(containerId) ?? [];
  if (!deep) return [...direct];
  const out: string[] = [];
  const seen = new Set<string>([containerId]);
  const walk = (cid: string) => {
    for (const c of links.children.get(cid) ?? []) {
      if (seen.has(c)) continue;
      seen.add(c); out.push(c); walk(c);
    }
  };
  walk(containerId);
  return out;
}

/** One pass over all items: grid key -> items drawn there (attached items are never drawn in a grid). */
export function gridBuckets(inv: Inventory, loadout: string = inv.activeLoadout): Map<string, GridItemView[]> {
  const buckets = new Map<string, GridItemView[]>();
  for (const id of Object.keys(inv.items)) {
    const item = inv.items[id];
    if (item.attachedTo) continue;
    const p = effectivePlace(inv, id, loadout);
    const ref = gridOfPlace(p);
    if (!ref || !p || p.kind === 'slot') continue;
    const [w, h] = footprintOf(item, p.rotated);
    const v: GridItemView = { id, x: p.x, y: p.y, w, h, rotated: p.rotated };
    if (ref.kind === 'archive' && item.location) v.locationTag = item.location;
    const key = refKey(ref);
    const list = buckets.get(key);
    if (list) list.push(v); else buckets.set(key, [v]);
  }
  return buckets;
}

/** Width, fixed height (null when growing), accepts and regions of a grid. */
export function gridShape(inv: Inventory, ref: GridRef, loadout: string = inv.activeLoadout): { width: number; height: number | null; accepts: string[] | null; regions: Region[] } {
  switch (ref.kind) {
    case 'stash': return { width: inv.settings.stashWidth, height: null, accepts: null, regions: [] };
    case 'archive': return { width: inv.archive.width, height: null, accepts: null, regions: [] };
    case 'pockets': {
      const [w, h] = loadoutOf(inv, loadout)?.pocketsGrid ?? [4, 1];
      return { width: w, height: h, accepts: null, regions: [] };
    }
    case 'panel': {
      const panel = inv.items[ref.in]?.panels?.find((p) => p.name === ref.panel);
      if (!panel) return { width: 0, height: 0, accepts: null, regions: [] };
      return { width: panel.grid[0], height: panel.grid[1], accepts: panel.accepts ?? null, regions: panel.regions ?? [] };
    }
  }
}

/**
 * The drawable grid. Stash/Archive height = max(lowest occupied row + PAD_ROWS, MIN_ROWS); panels are fixed.
 * Pass `buckets` (from gridBuckets) to avoid rescanning all items for every grid.
 * `loadout` (default the active one) draws the grid as that loadout sees it; buckets, if passed, must be built for it.
 */
export function gridView(inv: Inventory, ref: GridRef, buckets?: Map<string, GridItemView[]>, loadout: string = inv.activeLoadout): GridView {
  const items = (buckets ?? gridBuckets(inv, loadout)).get(refKey(ref)) ?? [];
  const shape = gridShape(inv, ref, loadout);
  let height = shape.height;
  if (height === null) {
    const bottom = items.reduce((m, v) => Math.max(m, v.y + v.h), 0);
    height = Math.max(bottom + PAD_ROWS, MIN_ROWS);
  }
  return { ref, width: shape.width, height, accepts: shape.accepts, regions: shape.regions, items };
}

/** Occupancy map "x,y" -> item id for a view, optionally ignoring one item (the one being dragged). */
export function occupancy(view: GridView, exclude?: string): Map<string, string> {
  const occ = new Map<string, string>();
  for (const v of view.items) {
    if (v.id === exclude) continue;
    for (let dy = 0; dy < v.h; dy++) for (let dx = 0; dx < v.w; dx++) occ.set(`${v.x + dx},${v.y + dy}`, v.id);
  }
  return occ;
}
