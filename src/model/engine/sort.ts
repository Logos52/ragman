/**
 * Sort button: auto-arrange one grid in the order of a SortMode, first-free top-left packing.
 *   size-desc: biggest area first, then category (settings order), then name
 *   name:      alphabetical by name
 *   category:  settings.categories order, then name
 *   status:    settings.statuses order (blank last), then name
 * Rotation is used only when the unrotated form does not fit. MUTATES `inv`.
 * Pinned and locked items stay exactly where they are; everything else is packed around them.
 * All-or-nothing: if any item cannot be packed (a full panel), nothing changes and it returns false.
 */
import type { GridRef, Inventory, SortMode } from '../types';
import { effectivePlace, footprintOf, gridView } from './place';
import { autoPlace } from './firstFree';

const indexIn = (list: string[], v: string | undefined) => { const i = v ? list.indexOf(v) : -1; return i < 0 ? list.length : i; };

export function sortOrder(inv: Inventory, ids: string[], mode: SortMode = 'size-desc'): string[] {
  const { categories, statuses } = inv.settings;
  const byName = (a: string, b: string) => inv.items[a].name.localeCompare(inv.items[b].name) || a.localeCompare(b);
  return [...ids].sort((a, b) => {
    const A = inv.items[a], B = inv.items[b];
    switch (mode) {
      case 'name': return byName(a, b);
      case 'category': return (indexIn(categories, A.category) - indexIn(categories, B.category)) || byName(a, b);
      case 'status': return (indexIn(statuses, A.status) - indexIn(statuses, B.status)) || byName(a, b);
      default: {
        const [aw, ah] = footprintOf(A), [bw, bh] = footprintOf(B);
        return (bw * bh - aw * ah) || (indexIn(categories, A.category) - indexIn(categories, B.category)) || byName(a, b);
      }
    }
  });
}

export function sortGrid(inv: Inventory, ref: GridRef, mode: SortMode = 'size-desc'): boolean {
  const view = gridView(inv, ref);
  const stays = (id: string) => !!(inv.items[id].pinned || inv.items[id].locked);
  const order = sortOrder(inv, view.items.map((v) => v.id).filter((id) => !stays(id)), mode);
  // Pack into a copy of the grid holding only the pinned and locked items, accumulating as we go.
  const packed = { ...view, items: view.items.filter((v) => stays(v.id)) };
  const spots: { id: string; x: number; y: number; rotated: boolean }[] = [];
  for (const id of order) {
    const spot = autoPlace(packed, id, inv.items[id]);
    if (!spot) return false;
    const [w, h] = footprintOf(inv.items[id], spot.rotated);
    packed.items.push({ id, x: spot.x, y: spot.y, w, h, rotated: spot.rotated });
    spots.push({ id, ...spot });
  }
  // effectivePlace returns the live object (the active loadout's placement or the home), so write through it.
  for (const s of spots) {
    const target = effectivePlace(inv, s.id);
    if (target && target.kind !== 'slot') { target.x = s.x; target.y = s.y; target.rotated = s.rotated; }
  }
  return true;
}
