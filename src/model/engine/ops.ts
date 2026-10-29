/**
 * Small in-place mutation primitives shared by the store, loadout switch, sort and normalize.
 * They MUTATE the inventory passed in: callers hand them a structuredClone (the store does).
 */
import type { GridRef, HomePlace, Inventory, PanelPlace } from '../types';
import { gridView, POCKETS_ID, POCKETS_PANEL } from './place';
import { autoPlace } from './firstFree';

/** A home place for a cell of a grid (pockets is never a home: it is a loadout placement). */
export function homeFromRef(ref: GridRef, x: number, y: number, rotated: boolean): HomePlace | null {
  switch (ref.kind) {
    case 'stash': return { kind: 'stash', location: ref.location, x, y, rotated };
    case 'archive': return { kind: 'archive', x, y, rotated };
    case 'panel': return { kind: 'panel', in: ref.in, panel: ref.panel, x, y, rotated };
    case 'pockets': return null;
  }
}

/** A loadout placement for a cell of a panel or the pockets. */
export function placementFromRef(ref: GridRef, x: number, y: number, rotated: boolean): PanelPlace | null {
  if (ref.kind === 'pockets') return { kind: 'panel', in: POCKETS_ID, panel: POCKETS_PANEL, x, y, rotated };
  if (ref.kind === 'panel') return { kind: 'panel', in: ref.in, panel: ref.panel, x, y, rotated };
  return null;
}

/** The stash an item belongs in: its location, else the fallback, else the first location. */
export function stashRefFor(inv: Inventory, id: string, fallback?: string): GridRef {
  const location = inv.items[id]?.location || fallback || inv.settings.locations[0] || '';
  return { kind: 'stash', location };
}

/**
 * Give the item a new home at the first free cells of a grid (not pockets), as `loadout` (default active) sees the grid.
 * Detaches it. False when it cannot fit.
 */
export function rehomeFirstFree(inv: Inventory, id: string, ref: GridRef, loadout: string = inv.activeLoadout): boolean {
  const item = inv.items[id];
  if (!item || ref.kind === 'pockets') return false;
  const spot = autoPlace(gridView(inv, ref, undefined, loadout), id, item);
  if (!spot) return false;
  item.home = homeFromRef(ref, spot.x, spot.y, spot.rotated);
  item.attachedTo = item.attachedTo ? null : item.attachedTo;
  return true;
}

/** Remove an item's placement from one loadout (default active) or all loadouts. */
export function clearPlacement(inv: Inventory, id: string, which: 'active' | 'all' = 'active'): void {
  const names = which === 'all' ? Object.keys(inv.loadouts) : [inv.activeLoadout];
  for (const n of names) if (inv.loadouts[n]?.placements[id]) delete inv.loadouts[n].placements[id];
}
