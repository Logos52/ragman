/**
 * First free top-left cell for a w x h footprint, scanning rows then columns.
 * Stash/Archive grow downward without limit, so they always have an answer when w <= width.
 */
import type { Cell, Cells, GridView, Item } from '../types';
import { footprintOf, isGrowing, occupancy } from './place';
import { acceptsItem, regionsAccept } from './fit';

export interface FirstFreeOpts {
  /** Ignore this item's own cells (it is the one being placed). */
  exclude?: string;
  /** Extra per-position test, e.g. region accepts. */
  ok?: (x: number, y: number, w: number, h: number) => boolean;
}

/** Matches api.ts FirstFreeFn, plus optional opts. */
export function firstFree(view: GridView, size: Cells, opts: FirstFreeOpts = {}): Cell | null {
  const [w, h] = size;
  if (w > view.width) return null;
  const occ = occupancy(view, opts.exclude);
  const growing = isGrowing(view.ref);
  // For a growing grid the row just below the lowest item is always free, so this bound always finds a spot.
  const bottom = view.items.reduce((m, v) => Math.max(m, v.y + v.h), 0);
  const lastY = growing ? bottom : view.height - h;
  for (let y = 0; y <= lastY; y++) {
    for (let x = 0; x + w <= view.width; x++) {
      let free = true;
      for (let dy = 0; dy < h && free; dy++) for (let dx = 0; dx < w && free; dx++) if (occ.has(`${x + dx},${y + dy}`)) free = false;
      if (free && (!opts.ok || opts.ok(x, y, w, h))) return [x, y];
    }
  }
  return null;
}

/**
 * Auto-place an item in a view: unrotated first, rotated only when the unrotated form does not fit.
 * Respects the grid's accepts and regions. Null when it cannot go anywhere.
 */
export function autoPlace(view: GridView, id: string, item: Item): { x: number; y: number; rotated: boolean } | null {
  if (!acceptsItem(view.accepts, item)) return null;
  const ok = (x: number, y: number, w: number, h: number) => regionsAccept(view.regions, item, x, y, w, h);
  for (const rotated of [false, true]) {
    const size = footprintOf(item, rotated);
    if (rotated && size[0] === size[1]) break;
    const c = firstFree(view, size, { exclude: id, ok });
    if (c) return { x: c[0], y: c[1], rotated };
  }
  return null;
}
