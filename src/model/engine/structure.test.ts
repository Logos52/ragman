/** Structure edits: panels, the active loadout's slots and pockets grid, attach / detach. */
import { describe, expect, it } from 'vitest';
import type { Inventory, Panel } from '../types';
import { fixture } from '../test/fixture';
import { normalize } from './normalize';
import { effectivePlace } from './place';
import { attach, attachRefusal, detach, setLoadoutSlots, setPanels, setPocketsGrid } from './structure';
import { moveItem } from './moves';

const inv0 = (): Inventory => normalize(fixture());
const panelsOf = (inv: Inventory, id: string) => structuredClone(inv.items[id].panels!) as Panel[];

describe('setPanels', () => {
  it('resizes a grid and keeps contents that still fit', () => {
    const inv = inv0();
    const p = panelsOf(inv, 'filson');
    p[0].grid = [7, 8];
    expect(setPanels(inv, 'filson', p, p.map((x) => x.name), 'USA')).toBe(true);
    expect(inv.items.filson.panels![0].grid).toEqual([7, 8]);
    expect(effectivePlace(inv, 'macbook')).toMatchObject({ kind: 'panel', in: 'filson', panel: 'Main', x: 0, y: 0 });
  });
  it('a rename carries the contents; a removed panel sends them to the stash', () => {
    const inv = inv0();
    const p = panelsOf(inv, 'filson');
    p[0].name = 'Main compartment';
    expect(setPanels(inv, 'filson', p, ['Main', 'Glasses pocket'], 'USA')).toBe(true);
    expect(inv.items.macbook.home).toMatchObject({ kind: 'panel', panel: 'Main compartment' });
    expect(setPanels(inv, 'filson', [p[1]], ['Glasses pocket'], 'USA')).toBe(true);
    expect(inv.items.macbook.home).toMatchObject({ kind: 'stash', location: 'USA' });
  });
  it('refuses bad input and a move of a locked item', () => {
    const inv = inv0();
    const p = panelsOf(inv, 'filson');
    expect(setPanels(inv, 'filson', [], [], 'USA')).toBe(false);
    expect(setPanels(inv, 'filson', [{ ...p[0] }, { ...p[0] }], [], 'USA')).toBe(false);
    expect(setPanels(inv, 'filson', [{ ...p[0], grid: [0, 3] }], [], 'USA')).toBe(false);
    expect(setPanels(inv, 'filson', [{ ...p[0], regions: [{ name: 'R', at: [5, 0], size: [4, 3], accepts: [] }] }], [], 'USA')).toBe(false);
    const locked = inv0();
    locked.items.macbook.locked = true;
    const q = panelsOf(locked, 'filson');
    q[0].grid = [3, 3];
    expect(setPanels(locked, 'filson', q, q.map((x) => x.name), 'USA')).toBe(false);
  });
});

describe('loadout slots and pockets', () => {
  it('adds a custom slot; removing a slot sends its item home', () => {
    const inv = inv0(); // Work: watch on Wrist
    const lo = inv.loadouts.Work;
    expect(setLoadoutSlots(inv, [...lo.slots, 'Belt'])).toBe(true);
    expect(inv.loadouts.Work.slots).toContain('Belt');
    expect(setLoadoutSlots(inv, inv.loadouts.Work.slots.filter((s) => s !== 'Wrist'))).toBe(true);
    expect(inv.loadouts.Work.placements.watch).toBeUndefined();
    expect(effectivePlace(inv, 'watch')).toMatchObject({ kind: 'stash' });
  });
  it('resizes pockets; an item that no longer fits is re-placed or goes home', () => {
    const inv = inv0();
    expect(moveItem(inv, 'cable', { kind: 'grid', grid: { kind: 'pockets' }, x: 2, y: 0, rotated: true }, 'USA')).toBe(true);
    expect(setPocketsGrid(inv, [5, 1])).toBe(true);
    expect(inv.loadouts.Work.pocketsGrid).toEqual([5, 1]);
    expect(setPocketsGrid(inv, [2, 1])).toBe(true);
    expect(effectivePlace(inv, 'cable')).toMatchObject({ kind: 'panel', x: 0, y: 0 });
    expect(setPocketsGrid(inv, [1, 1])).toBe(true);
    expect(effectivePlace(inv, 'cable')).toMatchObject({ kind: 'stash' });
    expect(setPocketsGrid(inv, [0, 1])).toBe(false);
  });
});

describe('attach / detach', () => {
  it('swaps a band: the old one goes to the stash, the new one goes where the watch goes', () => {
    const raw = fixture();
    raw.items.band2 = { name: 'Band 2', category: 'accessories', tags: ['band'], location: 'USA', home: { kind: 'stash', location: 'USA', x: 0, y: 5, rotated: false } };
    const inv = normalize(raw);
    expect(attachRefusal(inv, 'tee', 'watch', 'band')).toBe('not-accepted');
    expect(attachRefusal(inv, 'band2', 'watch', 'nope')).toBe('not-accepted');
    expect(attach(inv, 'band2', 'watch', 'band', 'USA')).toBe(true);
    expect(inv.items.band2.attachedTo).toEqual({ to: 'watch', slot: 'band' });
    expect(inv.items.band2.home).toBeNull();
    expect(inv.items.band.attachedTo).toBeNull();
    expect(inv.items.band.home).toMatchObject({ kind: 'stash' });
    expect(effectivePlace(inv, 'band2')).toEqual({ kind: 'slot', slot: 'Wrist' });
    expect(detach(inv, 'band2', 'USA')).toBe(true);
    expect(inv.items.band2.home).toMatchObject({ kind: 'stash' });
    expect(detach(inv, 'band2', 'USA')).toBe(false);
  });
});
