import { describe, expect, it } from 'vitest';
import type { GridRef, Inventory } from '../types';
import { fixture } from '../test/fixture';
import { normalize, stashMisfits } from './normalize';
import { gridView, minStashRows, occupancy } from './place';
import { firstFree } from './firstFree';
import { sortGrid } from './sort';
import { switchLoadout } from './loadout';
import { addItem, deleteItem, moveItem, sendToStash, unarchiveItem, updateItem } from './moves';
import { addLocation, attach, detach, itemsAt, moveLocation, removeLocation, renameLocation, setLoadoutSlots, setPanels, setPocketsGrid, setStashRows } from './structure';
import type { RefusalOut } from '../types';

const USA: GridRef = { kind: 'stash', location: 'USA' };
const inv0 = (): Inventory => normalize(fixture());

/** Put a 1x1 item on every free cell of a stash, as the active loadout draws it. */
function fill(inv: Inventory, location: string): void {
  const view = gridView(inv, { kind: 'stash', location });
  const occ = occupancy(view);
  for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) {
    if (occ.has(`${x},${y}`)) continue;
    inv.items[`f-${location}-${x}-${y}`] = { name: 'Filler', category: 'tops', location, home: { kind: 'stash', location, x, y, rotated: false } };
  }
}

describe('fixed stash height (settings.stashRows)', () => {
  it('normalize sets 68 rows when the file has none, and keeps a value that is there', () => {
    const raw = fixture();
    delete (raw.settings as Partial<Inventory['settings']>).stashRows;
    expect(normalize(raw).settings.stashRows).toBe(68);
    const set = fixture();
    set.settings.stashRows = 30;
    expect(normalize(set).settings.stashRows).toBe(30);
  });

  it('first-free scans only the 10 x stashRows cells and answers null when the stash is full', () => {
    const inv = inv0();
    inv.settings.stashRows = 4;
    expect(firstFree(gridView(inv, USA), [2, 2])).toEqual([0, 0]); // the Filson is carried in Work, its cells show free
    fill(inv, 'USA');
    expect(firstFree(gridView(inv, USA), [1, 1])).toBeNull();
    expect(gridView(inv, USA).height).toBe(4);
  });

  it('Sort packs inside the fixed grid and changes nothing when the items do not fit there', () => {
    const inv = inv0();
    inv.settings.stashWidth = 3;
    inv.settings.stashRows = 2;
    inv.settings.locations.push('Box');
    const put = (id: string, name: string, footprint: [number, number], x: number, y: number) => {
      inv.items[id] = { name, category: 'tops', footprint, location: 'Box', home: { kind: 'stash', location: 'Box', x, y, rotated: false } };
    };
    put('c', 'C', [2, 2], 0, 0);
    put('a', 'A', [1, 1], 2, 0);
    put('b', 'B', [1, 1], 2, 1);
    const box: GridRef = { kind: 'stash', location: 'Box' };
    expect(sortGrid(inv, box, 'name')).toBe(false); // A and B first leave no 2 x 2 hole in a 3 x 2 stash
    expect(inv.items.c.home).toMatchObject({ x: 0, y: 0 });
    expect(sortGrid(inv, box, 'size-desc')).toBe(true);
    for (const v of gridView(inv, box).items) expect(v.y + v.h).toBeLessThanOrEqual(2);
  });

  it('Add item, send to stash and unarchive refuse when the stash is full', () => {
    const inv = inv0();
    inv.settings.stashRows = 4;
    fill(inv, 'USA');
    expect(addItem(inv, 'new', { name: 'New', category: 'tops' }, 'USA')).toBe(false);
    expect(sendToStash(inv, 'macbook', 'USA')).toBe(false); // from the Filson's Main panel
    fill(inv, 'Vietnam');
    expect(unarchiveItem(inv, 'shirt', 'USA')).toBe(false); // the Old shirt lives in Vietnam
  });

  it('a drag out of the Archive refuses when the item needs a stash home and its stash is full', () => {
    const inv = inv0();
    fill(inv, 'Vietnam');
    expect(moveItem(inv, 'shirt', { kind: 'slot', slot: 'Torso Base' }, 'USA')).toBe(false);
  });

  it('a loadout switch refuses when an item going home finds its stash full', () => {
    const inv = inv0();
    inv.settings.stashRows = 4;
    delete inv.loadouts.Plane.placements.tee; // so Plane frees no cells of its own
    fill(inv, 'USA'); // Work carries the watch, so its home cells are free on screen and get filled
    expect(switchLoadout(inv, 'Plane')).toBeNull();
    expect(switchLoadout(inv0(), 'Plane')).not.toBeNull();
  });

  it('slots, pockets and panel edits refuse with reason full when an item going home finds its stash full', () => {
    const slots = inv0();
    slots.settings.stashRows = 4;
    fill(slots, 'USA'); // Work carries the watch, so its home cells are free on screen and get filled
    const why: RefusalOut = {};
    expect(setLoadoutSlots(slots, slots.loadouts.Work.slots.filter((s) => s !== 'Wrist'), why)).toBe(false);
    expect(why.reason).toBe('full');

    const pockets = inv0();
    pockets.settings.stashRows = 4;
    expect(moveItem(pockets, 'cable', { kind: 'grid', grid: { kind: 'pockets' }, x: 0, y: 0, rotated: true }, 'USA')).toBe(true);
    fill(pockets, 'USA');
    const whyP: RefusalOut = {};
    expect(setPocketsGrid(pockets, [1, 1], whyP)).toBe(false);
    expect(whyP.reason).toBe('full');

    const panels = inv0();
    panels.settings.stashRows = 4;
    fill(panels, 'USA');
    const p = structuredClone(panels.items.filson.panels!);
    const whyF: RefusalOut = {};
    expect(setPanels(panels, 'filson', [p[1]], [p[1].name], 'USA', whyF)).toBe(false); // the MacBook leaves Main
    expect(whyF.reason).toBe('full');
  });

  it('a panel edit that would move a locked item refuses with reason locked; a bad list with reason invalid', () => {
    const inv = inv0();
    inv.items.macbook.locked = true;
    const p = structuredClone(inv.items.filson.panels!);
    p[0] = { ...p[0], grid: [3, 8], regions: [] }; // the 4 x 3 MacBook only fits turned
    const why: RefusalOut = {};
    expect(setPanels(inv, 'filson', p, p.map((x) => x.name), 'USA', why)).toBe(false);
    expect(why.reason).toBe('locked');
    const bad: RefusalOut = {};
    expect(setPanels(inv, 'filson', [], [], 'USA', bad)).toBe(false);
    expect(bad.reason).toBe('invalid');
  });

  it('an attach swap refuses when the item it takes off has no room in its stash', () => {
    const inv = inv0();
    inv.settings.stashRows = 4;
    inv.items.band2 = { name: 'Band 2', category: 'accessories', tags: ['band'], location: 'Vietnam', home: { kind: 'stash', location: 'Vietnam', x: 0, y: 0, rotated: false } };
    fill(inv, 'USA');
    expect(attach(inv, 'band2', 'watch', 'band', 'USA')).toBe(false); // the old band would need USA cells
  });

  it('delete, detach and a location edit refuse instead of leaving an item with no place', () => {
    const inv = inv0();
    inv.settings.stashRows = 4;
    fill(inv, 'USA');
    expect(deleteItem(inv, 'filson', 'USA')).toBe(false); // the MacBook inside would need USA cells
    expect(detach(inv, 'band', 'USA')).toBe(false);
    const vn = inv0();
    fill(vn, 'Vietnam');
    expect(updateItem(vn, 'tee', { location: 'Vietnam' }, 'USA')).toBe(false);
  });

  it('migration: a stash home past the last row is re-placed in the first free cells of its stash', () => {
    const raw = fixture();
    raw.settings.stashRows = 12;
    raw.items.tee.home = { kind: 'stash', location: 'USA', x: 0, y: 40, rotated: false };
    const inv = normalize(raw);
    // first free cells as the active loadout draws the stash: Work carries the Filson, so its home cells show free
    expect(inv.items.tee.home).toMatchObject({ kind: 'stash', location: 'USA', x: 0, y: 0 });
    expect(stashMisfits(inv)).toEqual([]);
  });

  it('migration: an item that fits nowhere stays where it is and is named, never dropped', () => {
    const raw = fixture();
    raw.settings.stashRows = 2;
    const inv = normalize(raw);
    expect(inv.items.filson.home).toEqual({ kind: 'stash', location: 'USA', x: 0, y: 0, rotated: false }); // 3 x 4 in 2 rows
    expect(stashMisfits(inv)).toEqual(['filson']);
  });

  it('the Rows box: minimum is the lowest stash home bottom over every stash (carried homes count), maximum 200', () => {
    const inv = inv0();
    expect(minStashRows(inv)).toBe(4); // the Filson's home, though Work carries it
    expect(setStashRows(inv, 3)).toBe(false);
    expect(setStashRows(inv, 4.5)).toBe(false);
    expect(setStashRows(inv, 201)).toBe(false);
    expect(setStashRows(inv, 68)).toBe(false); // no change
    expect(setStashRows(inv, 4)).toBe(true);
    expect(setStashRows(inv, 200)).toBe(true);
    inv.items.tee.home = { kind: 'stash', location: 'Vietnam', x: 0, y: 10, rotated: false };
    expect(minStashRows(inv)).toBe(12);
  });
});

describe('stash tabs (settings.locations)', () => {
  it('add: trimmed, refused when blank or already there in any case', () => {
    const inv = inv0();
    expect(addLocation(inv, '  Storage unit ')).toBe(true);
    expect(inv.settings.locations).toEqual(['USA', 'Vietnam', 'Storage unit']);
    expect(addLocation(inv, '   ')).toBe(false);
    expect(addLocation(inv, ' usa')).toBe(false);
    expect(addLocation(inv, 'STORAGE UNIT')).toBe(false);
  });

  it('rename: settings, every item.location and every stash home follow; blank and duplicates refused', () => {
    const inv = inv0();
    expect(renameLocation(inv, 'USA', ' Home ')).toBe(true);
    expect(inv.settings.locations).toEqual(['Home', 'Vietnam']);
    expect(inv.items.tee).toMatchObject({ location: 'Home', home: { kind: 'stash', location: 'Home' } });
    expect(inv.items.filson.home).toMatchObject({ location: 'Home' }); // carried in Work, home still renamed
    expect(Object.values(inv.items).some((it) => it.location === 'USA')).toBe(false);
    expect(renameLocation(inv, 'Home', 'vietnam')).toBe(false);
    expect(renameLocation(inv, 'Home', ' ')).toBe(false);
    expect(renameLocation(inv, 'Nowhere', 'X')).toBe(false);
    expect(renameLocation(inv, 'Home', 'HOME')).toBe(true); // a case change of its own name
    expect(gridView(inv, { kind: 'stash', location: 'HOME' }).items.map((v) => v.id)).toContain('tee');
  });

  it('remove: refused while any item names it (stash, carried, archived) and for the last tab', () => {
    const inv = inv0();
    expect(itemsAt(inv, 'Vietnam')).toEqual(['shirt']); // archived, its location still Vietnam
    expect(removeLocation(inv, 'Vietnam')).toBe(false);
    inv.items.shirt.location = 'USA';
    expect(removeLocation(inv, 'Vietnam')).toBe(true);
    expect(inv.settings.locations).toEqual(['USA']);
    for (const it of Object.values(inv.items)) {
      it.location = undefined;
      if (it.home?.kind === 'stash') it.home = { kind: 'archive', x: 0, y: 0, rotated: false };
    }
    expect(itemsAt(inv, 'USA')).toEqual([]);
    expect(removeLocation(inv, 'USA')).toBe(false); // the last tab
  });

  it('a carried item whose home is in that stash blocks removal', () => {
    const inv = inv0();
    addLocation(inv, 'Bag drop');
    inv.items.watch.home = { kind: 'stash', location: 'Bag drop', x: 0, y: 0, rotated: false }; // location stays USA
    expect(itemsAt(inv, 'Bag drop')).toEqual(['watch']);
    expect(removeLocation(inv, 'Bag drop')).toBe(false);
  });

  it('move left and right; refused past either end', () => {
    const inv = inv0();
    addLocation(inv, 'Storage');
    expect(moveLocation(inv, 'Storage', -1)).toBe(true);
    expect(inv.settings.locations).toEqual(['USA', 'Storage', 'Vietnam']);
    expect(moveLocation(inv, 'USA', -1)).toBe(false);
    expect(moveLocation(inv, 'Vietnam', 1)).toBe(false);
    expect(moveLocation(inv, 'USA', 1)).toBe(true);
    expect(inv.settings.locations).toEqual(['Storage', 'USA', 'Vietnam']);
  });
});
