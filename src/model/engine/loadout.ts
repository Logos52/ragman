/**
 * Loadout switch. MUTATES `inv` (pass a clone).
 *
 * 1. The new loadout is settled first, by the PRD rule that a panel's contents come from placements first, then
 *    from homes. A home or a placement can have been written while another loadout was on screen (a drop into a
 *    panel of a container in the stash, a Sort, a footprint edit), so in this loadout it can collide:
 *    - a placement that runs out of its panel or overlaps an earlier placement of this loadout is re-placed at the
 *      first free cells of the same grid; when there are none it is dropped and the item falls back to its home;
 *    - a home drawn under one of this loadout's placements is moved to the first free cells of the same grid, else
 *      to its location's stash (an archived item: the Archive).
 * 2. Every item the old loadout placed (a slot, or a panel/pockets placement) that the new loadout does not place
 *    goes back to its home. If that home is now occupied or invalid, the item is auto-placed at the first free cells
 *    of its location's stash (an archived item: of the Archive) and its home is rewritten.
 * Items that live in a container's panel through `home` need nothing else: they travel with the container.
 * Returns the ids whose home or placement was rewritten.
 */
import type { GridItemView, GridRef, Inventory } from '../types';
import { effectivePlace, gridBuckets, gridOfPlace, gridShape, gridView } from './place';
import { fitAt } from './fit';
import { autoPlace } from './firstFree';
import { rehomeFirstFree, stashRefFor } from './ops';

const cellKeys = (v: GridItemView) => {
  const out: string[] = [];
  for (let dy = 0; dy < v.h; dy++) for (let dx = 0; dx < v.w; dx++) out.push(`${v.x + dx},${v.y + dy}`);
  return out;
};

/** Home fallback: keep a valid home, else first free cells of the location's stash (archived: the Archive). */
function settleHome(inv: Inventory, id: string, rehomed: string[]): void {
  const item = inv.items[id];
  if (!item || item.attachedTo) return; // goes wherever its parent goes
  const home = item.home ?? null;
  const ref = gridOfPlace(home);
  const valid = !!home && !!ref && fitAt(inv, id, ref, home.x, home.y, home.rotated).ok;
  if (valid) return;
  const target: GridRef = home?.kind === 'archive' ? { kind: 'archive' } : stashRefFor(inv, id);
  if (rehomeFirstFree(inv, id, target)) rehomed.push(id);
}

/** Step 1: placements first, then homes, in every grid the active loadout draws. */
function settleActive(inv: Inventory, rehomed: string[], fallenBack: string[]): void {
  const lo = inv.loadouts[inv.activeLoadout];
  const isPlacement = (id: string) => !!lo.placements[id] && effectivePlace(inv, id) === lo.placements[id];
  const placementLosers: string[] = [];
  const homeLosers: string[] = [];
  for (const items of gridBuckets(inv).values()) {
    const placed = items.filter((v) => isPlacement(v.id));
    if (!placed.length) continue;
    const ref = gridOfPlace(effectivePlace(inv, placed[0].id))!;
    const { width, height } = gridShape(inv, ref);
    const occ = new Set<string>();
    for (const v of placed) {
      const cells = cellKeys(v);
      const inBounds = v.x >= 0 && v.y >= 0 && v.x + v.w <= width && (height === null || v.y + v.h <= height);
      if (inBounds && !cells.some((c) => occ.has(c))) cells.forEach((c) => occ.add(c));
      else placementLosers.push(v.id);
    }
    for (const v of items) if (!isPlacement(v.id) && cellKeys(v).some((c) => occ.has(c))) homeLosers.push(v.id);
  }
  for (const id of placementLosers) {
    const p = lo.placements[id];
    if (!p || p.kind === 'slot') continue;
    const spot = autoPlace(gridView(inv, gridOfPlace(p)!), id, inv.items[id]);
    if (spot) { p.x = spot.x; p.y = spot.y; p.rotated = spot.rotated; }
    else { delete lo.placements[id]; fallenBack.push(id); }
    rehomed.push(id);
  }
  for (const id of homeLosers) {
    const home = inv.items[id].home;
    if (!home) continue;
    const spot = autoPlace(gridView(inv, gridOfPlace(home)!), id, inv.items[id]);
    if (spot) { home.x = spot.x; home.y = spot.y; home.rotated = spot.rotated; rehomed.push(id); continue; }
    const target: GridRef = home.kind === 'archive' ? { kind: 'archive' } : stashRefFor(inv, id);
    if (rehomeFirstFree(inv, id, target)) rehomed.push(id);
  }
}

export function switchLoadout(inv: Inventory, name: string): string[] {
  const oldLo = inv.loadouts[inv.activeLoadout];
  const newLo = inv.loadouts[name];
  if (!newLo || name === inv.activeLoadout) return [];
  inv.activeLoadout = name;
  const rehomed: string[] = [];
  const fallenBack: string[] = [];
  settleActive(inv, rehomed, fallenBack);
  const returning = oldLo ? Object.keys(oldLo.placements).filter((id) => inv.items[id] && !newLo.placements[id]) : [];
  for (const id of [...fallenBack, ...returning]) settleHome(inv, id, rehomed);
  return [...new Set(rehomed)];
}

/**
 * Re-settle the active loadout after its own shape changed (slot list, pockets grid): placements first, then homes,
 * as on a switch; `leaving` (placements just removed) and every placement that had to be dropped go back to their home.
 */
export function settleLoadout(inv: Inventory, leaving: string[]): string[] {
  const rehomed: string[] = [];
  const fallenBack: string[] = [];
  settleActive(inv, rehomed, fallenBack);
  for (const id of [...fallenBack, ...leaving]) settleHome(inv, id, rehomed);
  return [...new Set(rehomed)];
}
