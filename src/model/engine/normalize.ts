/**
 * Load migration. Returns a fixed copy; the input is not touched. Existing keys keep their order.
 * - arrays/objects exist (items, loadouts, tasks, skills, settings lists), archive.width defaults to stashWidth
 * - quickUse has exactly 10 entries (padded with null, extra dropped); unknown ids become null
 * - every loadout has slots, placements and pocketsGrid (default [4, 1]); activeLoadout names a real loadout
 * - an attachment whose parent is gone is detached and homed in its stash
 * - a non-attached item with no home gets one at the first free cells of its location's stash
 * - an item with status Not Worn whose home is a stash place moves to the Archive's first free cells
 * Never defaulted (absent stays absent, so a save does not write them): pinned, locked, verified, nickname, quantity
 * (absent counts as 1, see stacks.quantityOf), task unlocks.
 */
import type { Inventory } from '../types';
import { rehomeFirstFree, stashRefFor } from './ops';

export const NOT_WORN = 'Not Worn';

export function normalize(raw: Inventory): Inventory {
  const inv = structuredClone(raw) as Inventory;
  inv.settings ??= { statuses: [], categories: [], locations: [], defaultSlots: [], stashWidth: 10 };
  const s = inv.settings;
  s.statuses ??= []; s.categories ??= []; s.locations ??= []; s.defaultSlots ??= []; s.stashWidth ??= 10;
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
  return inv;
}
