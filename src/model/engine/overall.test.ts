import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixture';
import { overallSummary } from './overall';

describe('overallSummary', () => {
  it('counts items, statuses (settings order, zeros kept, blank last) and locations', () => {
    const s = overallSummary(fixture());
    expect(s.items).toBe(9);
    expect(s.byStatus).toEqual([
      { name: 'Daily', count: 1 }, { name: 'Rotation', count: 0 }, { name: 'Seasonal', count: 0 },
      { name: 'Travel Only', count: 0 }, { name: 'Not Worn', count: 1 }, { name: 'Retired', count: 0 },
      { name: '', count: 7 },
    ]);
    expect(s.byLocation).toEqual([{ name: 'USA', count: 7 }, { name: 'Vietnam', count: 1 }, { name: '', count: 1 }]);
  });

  it('keeps a status that is not in settings, after the settings ones', () => {
    const inv = fixture();
    inv.items.cable.status = 'Lent out';
    expect(overallSummary(inv).byStatus.map((r) => r.name)).toEqual(
      ['Daily', 'Rotation', 'Seasonal', 'Travel Only', 'Not Worn', 'Retired', 'Lent out', '']);
  });

  it('gives every loadout its carried items and weight, not only the active one', () => {
    const s = overallSummary(fixture());
    expect(s.loadouts.map((l) => [l.name, l.active, l.items])).toEqual([['Work', true, 4], ['Plane', false, 3]]);
    expect(s.loadouts[0].weight).toMatchObject({ grams: 2580, unweighed: 0, estimated: 0 }); // filson, macbook, watch, band
    expect(s.loadouts[1].weight).toMatchObject({ grams: 2700, unweighed: 0, estimated: 0 }); // filson, macbook, tee
  });

  it('counts unweighed and estimated weights per loadout', () => {
    const inv = fixture();
    inv.items.tee.weight_g = null;
    inv.items.macbook.weightEstimated = true;
    const [work, plane] = overallSummary(inv).loadouts;
    expect(work.weight).toMatchObject({ grams: 2580, unweighed: 0, estimated: 1 });
    expect(plane.weight).toMatchObject({ grams: 2500, unweighed: 1, estimated: 1 });
  });

  it('measures stash fill over the rows used', () => {
    const [usa, vietnam, archive] = overallSummary(fixture()).stashes;
    // Work on screen: tee 2x2, cable 1x2, glasses case 2x1 in USA (the Filson and the watch are on the person)
    expect(usa).toEqual({ ref: { kind: 'stash', location: 'USA' }, items: 3, occupied: 8, rows: 2, cells: 20, fill: 0.4 });
    expect(vietnam).toMatchObject({ occupied: 4, rows: 2, cells: 20, fill: 0.2 });
    expect(archive).toEqual({ ref: { kind: 'archive' }, items: 0, occupied: 0, rows: 0, cells: 0, fill: null });
  });

  it('lists containers whose every panel is empty, with where they are drawn', () => {
    expect(overallSummary(fixture()).emptyContainers).toEqual([]);
    const inv = fixture();
    inv.items.glasses.home = { kind: 'stash', location: 'USA', x: 0, y: 5, rotated: false };
    inv.items.macbook.home = { kind: 'stash', location: 'USA', x: 0, y: 6, rotated: false };
    expect(overallSummary(inv).emptyContainers).toEqual([
      { id: 'filson', where: { kind: 'slot', slot: 'Backpack' } },
      { id: 'glasses-case', where: { kind: 'stash', location: 'USA' } },
    ]);
  });
});
