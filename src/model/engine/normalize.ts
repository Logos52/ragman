/**
 * Load migration. Returns a fixed copy; the input is not touched. Existing keys keep their order.
 * - arrays/objects exist (items, loadouts, tasks, skills, settings lists), archive.width defaults to stashWidth
 * - quickUse has exactly 10 entries (padded with null, extra dropped); unknown ids become null
 * - every loadout has slots, placements and pocketsGrid (default [4, 1]); activeLoadout names a real loadout
 * - an attachment whose parent is gone is detached and homed in its stash
 * - a non-attached item with no home gets one at the first free cells of its location's stash
 * - an item with status Not Worn whose home is a stash place moves to the Archive's first free cells
 * - settings.stashRows defaults to 68 (a stash is stashWidth x stashRows); a stash home that runs past the last row
 *   or column is re-placed at the first free cells of the same stash; when there are none it stays where it is and
 *   `stashMisfits` names it (the store shows that as a load error), so nothing is dropped
 * Never defaulted (absent stays absent, so a save does not write them): pinned, locked, verified, nickname, quantity
 * (absent counts as 1, see stacks.quantityOf), task unlocks.
 */
import type { Inventory } from '../types';
import { rehomeFirstFree, stashRefFor } from './ops';
import { DEFAULT_STASH_ROWS, footprintOf } from './place';

export const NOT_WORN = 'Not Worn';

export function normalize(raw: Inventory): Inventory {
  const inv = structuredClone(raw) as Inventory;
  inv.settings ??= { statuses: [], categories: [], locations: [], defaultSlots: [], stashWidth: 10, stashRows: DEFAULT_STASH_ROWS };
  const s = inv.settings;
  s.statuses ??= []; s.categories ??= []; s.locations ??= []; s.defaultSlots ??= []; s.stashWidth ??= 10;
  s.stashRows ??= DEFAULT_STASH_ROWS;
  inv.items ??= {};
  inv.loadouts ??= {};
  inv.tasks ??= [];
  inv.skills ??= [];
  inv.archive ??= { width: s.stashWidth };
  inv.archive.width ??= s.stashWidth;

  for (const lo of Object.values(inv.loadouts)) {
    lo.slots ??= [...s.defaultSlots];
    lo.placements ??= {};
    lo.pocketsGrid ??= [4, 1];
  }
  if (!inv.loadouts[inv.activeLoadout]) {
    const first = Object.keys(inv.loadouts)[0];
    if (first) inv.activeLoadout = first;
    else {
      inv.activeLoadout = inv.activeLoadout || 'Work';
      inv.loadouts[inv.activeLoadout] = { slots: [...s.defaultSlots], pocketsGrid: [4, 1], placements: {} };
    }
  }

  const q = Array.isArray(inv.quickUse) ? inv.quickUse.slice(0, 10) : [];
  while (q.length < 10) q.push(null);
  inv.quickUse = q.map((id) => (id && inv.items[id] ? id : null));

  for (const [id, item] of Object.entries(inv.items)) {
    if (item.attachedTo && !inv.items[item.attachedTo.to]) item.attachedTo = null;
    if (!item.attachedTo && !item.home) rehomeFirstFree(inv, id, stashRefFor(inv, id));
  }
  for (const [id, item] of Object.entries(inv.items)) {
    if (item.status === NOT_WORN && item.home?.kind === 'stash') rehomeFirstFree(inv, id, { kind: 'archive' });
  }
  for (const id of outsideStash(inv)) {
    const h = inv.items[id].home;
    if (h?.kind === 'stash') rehomeFirstFree(inv, id, { kind: 'stash', location: h.location });
  }
  return inv;
}

/** Stash homes that run past the stash's last row or column. */
function outsideStash(inv: Inventory): string[] {
  const { stashWidth, stashRows } = inv.settings;
  return Object.keys(inv.items).filter((id) => {
    const it = inv.items[id];
    const h = it.home;
    if (it.attachedTo || h?.kind !== 'stash') return false;
    const [w, hh] = footprintOf(it, h.rotated);
    return h.x < 0 || h.y < 0 || h.x + w > stashWidth || h.y + hh > stashRows;
  });
}

/**
 * Items left without a valid place after normalize: a stash home outside the stash (it was full), or no home at all
 * on an item that is not attached. Empty on a good file.
 */
export function stashMisfits(inv: Inventory): string[] {
  const homeless = Object.keys(inv.items).filter((id) => !inv.items[id].attachedTo && !inv.items[id].home);
  return [...outsideStash(inv), ...homeless];
}
