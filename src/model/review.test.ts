/** Review repros (engine correctness). Each case asserts the behaviour the PRD requires; a failing case is a defect. */
import { describe, expect, it } from 'vitest';
import type { GridRef, Inventory } from './types';
import { fixture } from './test/fixture';
import { normalize } from './engine/normalize';
import { gridView } from './engine/place';
import { switchLoadout } from './engine/loadout';
import { deleteItem, moveItem, updateItem } from './engine/moves';
import { NOT_WORN } from './engine/normalize';
import { sortGrid } from './engine/sort';

const inv0 = (): Inventory => normalize(fixture());
const overlaps = (inv: Inventory, ref: GridRef) => {
  const seen = new Set<string>();
  for (const v of gridView(inv, ref).items) for (let dx = 0; dx < v.w; dx++) for (let dy = 0; dy < v.h; dy++) {
    const k = `${v.x + dx},${v.y + dy}`;
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
};

describe('review: archive', () => {
  it('dragging an archived item out of the Archive onto a slot clears Not Worn', () => {
    const inv = inv0();
    expect(inv.items.shirt.home?.kind).toBe('archive');
    expect(moveItem(inv, 'shirt', { kind: 'slot', slot: 'Torso Base' }, 'USA')).toBe(true);
    expect(inv.items.shirt.status).not.toBe(NOT_WORN);
  });
  it('dragging an archived item into a panel of a container in the stash clears Not Worn', () => {
    const inv = inv0();
    inv.activeLoadout = 'Plane';
    inv.loadouts.Plane.placements = {}; // Filson sits in the stash
    expect(moveItem(inv, 'shirt', { kind: 'grid', grid: { kind: 'panel', in: 'filson', panel: 'Main' }, x: 4, y: 0, rotated: false }, 'USA')).toBe(true);
    expect(inv.items.shirt.home?.kind).toBe('panel');
    expect(inv.items.shirt.status).not.toBe(NOT_WORN);
  });
});

describe('review: cross-loadout home writes', () => {
  it('a home written into a panel in one loadout never overlaps a placement in another loadout', () => {
    const inv = inv0();
    inv.loadouts.Home = { slots: [...inv.settings.defaultSlots], pocketsGrid: [4, 1], placements: {} };
    const MAIN: GridRef = { kind: 'panel', in: 'filson', panel: 'Main' };
    switchLoadout(inv, 'Plane'); // Filson carried
    expect(moveItem(inv, 'cable', { kind: 'grid', grid: MAIN, x: 4, y: 0, rotated: false }, 'USA')).toBe(true); // Plane placement
    switchLoadout(inv, 'Home'); // Filson back in the stash
    expect(moveItem(inv, 'watch', { kind: 'grid', grid: MAIN, x: 4, y: 0, rotated: false }, 'USA')).toBe(true); // writes watch.home
    switchLoadout(inv, 'Plane');
    expect(overlaps(inv, MAIN)).toBe(false);
  });
  it('Sort in one loadout never makes a panel overlap in another loadout', () => {
    const inv = inv0();
    inv.loadouts.Home = { slots: [...inv.settings.defaultSlots], pocketsGrid: [4, 1], placements: {} };
    const MAIN: GridRef = { kind: 'panel', in: 'filson', panel: 'Main' };
    switchLoadout(inv, 'Plane');
    expect(moveItem(inv, 'cable', { kind: 'grid', grid: MAIN, x: 4, y: 0, rotated: false }, 'USA')).toBe(true);
    switchLoadout(inv, 'Home');
    expect(moveItem(inv, 'watch', { kind: 'grid', grid: MAIN, x: 4, y: 3, rotated: false }, 'USA')).toBe(true);
    switchLoadout(inv, 'Plane');
    expect(overlaps(inv, MAIN)).toBe(false); // fine before the sort
    switchLoadout(inv, 'Home');
    expect(sortGrid(inv, MAIN, 'size-desc')).toBe(true); // watch home -> (4,0)
    switchLoadout(inv, 'Plane');
    expect(overlaps(inv, MAIN)).toBe(false);
  });
  it('a footprint edit re-fits the item in every loadout, not only the active one', () => {
    const inv = inv0();
    switchLoadout(inv, 'Plane');
    const POCKETS: GridRef = { kind: 'pockets' };
    expect(moveItem(inv, 'cable', { kind: 'grid', grid: POCKETS, x: 0, y: 0, rotated: true }, 'USA')).toBe(true); // 2x1
    expect(moveItem(inv, 'glasses', { kind: 'grid', grid: POCKETS, x: 2, y: 0, rotated: false }, 'USA')).toBe(true); // 2x1
    switchLoadout(inv, 'Work');
    expect(updateItem(inv, 'cable', { footprint: [1, 3] }, 'USA')).toBe(true); // now 3x1 rotated
    switchLoadout(inv, 'Plane');
    expect(overlaps(inv, POCKETS)).toBe(false);
  });
});

describe('review: delete', () => {
  it('PRD: deleting an item removes its attachments\' links (the band survives, detached)', () => {
    const inv = inv0();
    expect(deleteItem(inv, 'watch', 'USA')).toBe(true);
    expect(inv.items.band).toBeDefined();
  });
});

describe('review: fixes, more routes', () => {
  const MAIN: GridRef = { kind: 'panel', in: 'filson', panel: 'Main' };
  it('an archived item dragged into the pockets or a carried bag leaves the Archive (status clear, home in its stash)', () => {
    for (const grid of [{ kind: 'pockets' } as GridRef, MAIN]) {
      const inv = inv0();
      inv.loadouts.Plane.pocketsGrid = [4, 2]; // room for the 2x2 shirt
      switchLoadout(inv, 'Plane'); // Filson carried in Backpack
      expect(moveItem(inv, 'shirt', { kind: 'grid', grid, x: grid.kind === 'panel' ? 4 : 0, y: 0, rotated: false }, 'USA')).toBe(true);
      expect(inv.items.shirt.status).toBe('');
      expect(inv.items.shirt.home).toMatchObject({ kind: 'stash', location: 'Vietnam' });
      expect(gridView(inv, { kind: 'archive' }).items.map((v) => v.id)).not.toContain('shirt');
    }
  });
  it('an archived item dropped into a container that sits in the Archive stays archived', () => {
    const inv = inv0();
    inv.items.filson.status = NOT_WORN;
    inv.items.filson.home = { kind: 'archive', x: 4, y: 0, rotated: false };
    for (const lo of Object.values(inv.loadouts)) delete lo.placements.filson;
    expect(moveItem(inv, 'shirt', { kind: 'grid', grid: MAIN, x: 4, y: 0, rotated: false }, 'USA')).toBe(true);
    expect(inv.items.shirt.status).toBe(NOT_WORN);
  });
  it('the loser of a cross-loadout collision is re-placed in the same panel, and the placement keeps its cells', () => {
    const inv = inv0();
    inv.loadouts.Home = { slots: [...inv.settings.defaultSlots], pocketsGrid: [4, 1], placements: {} };
    switchLoadout(inv, 'Plane');
    moveItem(inv, 'cable', { kind: 'grid', grid: MAIN, x: 4, y: 0, rotated: false }, 'USA');
    switchLoadout(inv, 'Home');
    moveItem(inv, 'watch', { kind: 'grid', grid: MAIN, x: 4, y: 0, rotated: false }, 'USA');
    switchLoadout(inv, 'Plane');
    expect(inv.loadouts.Plane.placements.cable).toMatchObject({ x: 4, y: 0 });
    expect(inv.items.watch.home).toMatchObject({ kind: 'panel', in: 'filson', panel: 'Main' });
    expect(overlaps(inv, MAIN)).toBe(false);
    switchLoadout(inv, 'Home');
    expect(overlaps(inv, MAIN)).toBe(false);
  });
  it('a footprint edit that no longer fits a fixed panel in another loadout drops that placement back to the home', () => {
    const inv = inv0();
    switchLoadout(inv, 'Plane');
    expect(moveItem(inv, 'cable', { kind: 'grid', grid: { kind: 'pockets' }, x: 0, y: 0, rotated: true }, 'USA')).toBe(true);
    switchLoadout(inv, 'Work');
    updateItem(inv, 'cable', { footprint: [1, 5] }, 'USA'); // 5x1 rotated, 1x5 upright: never fits 4x1 pockets
    expect(inv.loadouts.Plane.placements.cable).toBeUndefined();
    expect(inv.items.cable.home?.kind).toBe('stash');
  });
  it('deleting an item sends a Not Worn attachment to the Archive, detached', () => {
    const inv = inv0();
    inv.items.band.status = NOT_WORN;
    deleteItem(inv, 'watch', 'USA');
    expect(inv.items.band.attachedTo).toBeNull();
    expect(inv.items.band.home?.kind).toBe('archive');
  });
});

describe('review: updateItem patch guard', () => {
  it('never writes home, panels, attachedTo or hidden from a patch, even from an untyped caller', () => {
    const inv = inv0();
    const before = structuredClone(inv.items);
    const patch = {
      note: 'edited',
      home: { kind: 'stash', location: 'USA', x: 0, y: 0, rotated: false },
      panels: [],
      attachedTo: { to: 'watch', slot: 'band' },
      hidden: { source: 'overwritten?' },
    } as unknown as Parameters<typeof updateItem>[2];
    for (const id of ['cable', 'filson', 'band']) {
      expect(updateItem(inv, id, patch, 'USA')).toBe(true);
      expect(inv.items[id].note).toBe('edited');
      expect(inv.items[id].home).toEqual(before[id].home);
      expect(inv.items[id].panels).toEqual(before[id].panels);
      expect(inv.items[id].attachedTo).toEqual(before[id].attachedTo);
      expect(inv.items[id].hidden).toEqual(before[id].hidden);
    }
    expect(overlaps(inv, { kind: 'stash', location: 'USA' })).toBe(false);
  });
});
