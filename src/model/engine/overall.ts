/**
 * The Overall tab's numbers. Pure, read-only, one pass per section.
 * - byStatus / byLocation: settings order (zeros kept), then values found in the data that are not in settings,
 *   then the blank value ('') when any item has none.
 * - loadouts: for every loadout, the ids `carriedIds` returns for it (the footer's carried set) and their weight.
 *   A loadout that is not on screen is read as stored, without the settle a switch would run.
 * - stashes: each location's stash, then the Archive, as the active loadout draws them.
 * - emptyContainers: items with panels where no item sits in any panel, at the active loadout's placement.
 */
import type { CountRow, EmptyContainer, Inventory, OverallSummary, StashFill } from '../types';
import { buildLinks, effectivePlace, gridBuckets, gridOfPlace, gridView, isContainer, occupancy } from './place';
import { carriedWeight, carriedIds } from './weights';

function countBy(inv: Inventory, order: string[], key: (id: string) => string | undefined): CountRow[] {
  const counts = new Map<string, number>(order.map((n) => [n, 0]));
  let blank = 0;
  for (const id of Object.keys(inv.items)) {
    const v = (key(id) ?? '').trim();
    if (!v) { blank++; continue; }
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const rows = [...counts].map(([name, count]) => ({ name, count }));
  if (blank) rows.push({ name: '', count: blank });
  return rows;
}

export function overallSummary(inv: Inventory): OverallSummary {
  const buckets = gridBuckets(inv);
  const links = buildLinks(inv);

  const loadouts = Object.keys(inv.loadouts).map((name) => {
    const l = name === inv.activeLoadout ? links : buildLinks(inv, name);
    return {
      name,
      active: name === inv.activeLoadout,
      items: carriedIds(inv, l, name).length,
      weight: carriedWeight(inv, l, name),
    };
  });

  const refs: StashFill['ref'][] = [...inv.settings.locations.map((location) => ({ kind: 'stash' as const, location })), { kind: 'archive' }];
  const stashes: StashFill[] = refs.map((ref) => {
    const view = gridView(inv, ref, buckets);
    const occupied = occupancy(view).size;
    const rows = view.items.reduce((m, v) => Math.max(m, v.y + v.h), 0);
    const cells = view.width * rows;
    return { ref, items: view.items.length, occupied, rows, cells, fill: cells ? occupied / cells : null };
  });

  const emptyContainers: EmptyContainer[] = [];
  for (const [id, item] of Object.entries(inv.items)) {
    if (!isContainer(item) || (links.children.get(id) ?? []).length) continue;
    const p = effectivePlace(inv, id);
    emptyContainers.push({ id, where: p?.kind === 'slot' ? { kind: 'slot', slot: p.slot } : gridOfPlace(p) });
  }

  return {
    items: Object.keys(inv.items).length,
    byStatus: countBy(inv, inv.settings.statuses, (id) => inv.items[id].status),
    byLocation: countBy(inv, inv.settings.locations, (id) => inv.items[id].location),
    loadouts,
    stashes,
    emptyContainers,
  };
}
