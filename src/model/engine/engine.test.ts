import { describe, expect, it } from 'vitest';
import type { GridRef, Inventory } from '../types';
import { fixture } from '../test/fixture';
import { normalize } from './normalize';
import { effectivePlace, footprintOf, gridView, POCKETS_ID } from './place';
import { canFit } from './fit';
import { firstFree } from './firstFree';
import { carriedWeight, weightOf } from './weights';
import { switchLoadout } from './loadout';
import { sortGrid } from './sort';
import { taskChecklist, tasksView } from './tasks';
import { UndoRing } from './undo';
import { exportJson, serializeInventory } from './strip';
import { archiveItem, deleteItem, moveItem, sendToStash, unarchiveItem, equipItem, addItem } from './moves';
import { imagePath } from './images';
import { share } from './share';

const USA: GridRef = { kind: 'stash', location: 'USA' };
const MAIN: GridRef = { kind: 'panel', in: 'filson', panel: 'Main' };
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

describe('normalize', () => {
  it('pads quickUse to 10, defaults pocketsGrid, archives Not Worn stash items, fills arrays', () => {
    const raw = fixture() as Partial<Inventory> & Inventory;
    delete (raw as Partial<Inventory>).skills;
    const inv = normalize(raw);
    expect(inv.quickUse).toHaveLength(10);
    expect(inv.quickUse[0]).toBe('macbook');
    expect(inv.loadouts.Work.pocketsGrid).toEqual([4, 1]);
    expect(inv.skills).toEqual([]);
    expect(inv.items.shirt.home).toEqual({ kind: 'archive', x: 0, y: 0, rotated: false });
    expect(raw.items.shirt.home?.kind).toBe('stash'); // input untouched
  });
});

describe('placement', () => {
  it('resolves loadout placement, home, attachments and invalid slots', () => {
    const inv = inv0();
    expect(effectivePlace(inv, 'watch')).toEqual({ kind: 'slot', slot: 'Wrist' });
    expect(effectivePlace(inv, 'band')).toEqual({ kind: 'slot', slot: 'Wrist' });
    expect(effectivePlace(inv, 'macbook')).toMatchObject({ kind: 'panel', in: 'filson' });
    inv.loadouts.Work.placements.cable = { kind: 'slot', slot: 'Carry-on' }; // Work has no Carry-on
    expect(effectivePlace(inv, 'cable')).toMatchObject({ kind: 'stash', x: 5 });
  });
  it('footprint: blank is 1x1, rotation swaps', () => {
    const inv = inv0();
    expect(footprintOf(inv.items.band)).toEqual([1, 1]);
    expect(footprintOf(inv.items.cable, true)).toEqual([2, 1]);
  });
  it('stash height grows: max(bottom + 4, 12); archive carries location tags', () => {
    const inv = inv0();
    expect(gridView(inv, USA).height).toBe(12);
    inv.items.tee.home = { kind: 'stash', location: 'USA', x: 0, y: 20, rotated: false };
    expect(gridView(inv, USA).height).toBe(26);
    const arch = gridView(inv, { kind: 'archive' });
    expect(arch.items).toEqual([{ id: 'shirt', x: 0, y: 0, w: 2, h: 2, rotated: false, locationTag: 'Vietnam' }]);
    expect(gridView(inv, MAIN).height).toBe(8);
  });
});

describe('fit rule', () => {
  it('regions: overlap must be accepted; a region item may sit outside', () => {
    const inv = inv0();
    const at = (id: string, x: number, y: number, rotated = false) => canFit(inv, id, { kind: 'grid', grid: MAIN, x, y, rotated });
    expect(at('macbook', 0, 0).ok).toBe(true);
    expect(at('tee', 0, 0).reason).toBe('not-accepted');
    expect(at('tee', 3, 0).reason).toBe('not-accepted'); // touches the sleeve's last column
    expect(at('tee', 4, 0).ok).toBe(true);
    expect(at('macbook', 0, 4).ok).toBe(true);
    expect(at('tee', 5, 0).reason).toBe('out-of-bounds');
    expect(at('tee', 0, 3).cells).toHaveLength(4);
  });
  it('occupied ignores the item itself; rotation changes the cells', () => {
    const inv = inv0();
    const st = (id: string, x: number, y: number, rotated = false) => canFit(inv, id, { kind: 'grid', grid: USA, x, y, rotated });
    expect(st('cable', 3, 0).reason).toBe('occupied');
    expect(st('tee', 3, 1).ok).toBe(true);
    expect(st('cable', 0, 0, true).cells).toEqual([[0, 0], [1, 0]]);
    expect(st('cable', 4, 2, true).ok).toBe(true);
    expect(st('cable', 9, 3, true).reason).toBe('out-of-bounds');
    expect(st('cable', 0, 500).ok).toBe(true); // stash grows without limit
  });
  it('panel accepts filter', () => {
    const inv = inv0();
    const g: GridRef = { kind: 'panel', in: 'glasses-case', panel: 'Main' };
    expect(canFit(inv, 'cable', { kind: 'grid', grid: g, x: 0, y: 0, rotated: true }).reason).toBe('not-accepted');
    expect(canFit(inv, 'glasses', { kind: 'grid', grid: g, x: 0, y: 0, rotated: false }).ok).toBe(true);
  });
  it('self and cycle', () => {
    const inv = inv0();
    expect(canFit(inv, 'filson', { kind: 'grid', grid: MAIN, x: 0, y: 4, rotated: false }).reason).toBe('self');
    inv.items['glasses-case'].home = { kind: 'panel', in: 'filson', panel: 'Glasses pocket', x: 0, y: 0, rotated: false };
    const g: GridRef = { kind: 'panel', in: 'glasses-case', panel: 'Main' };
    inv.items.filson.tags = ['eyewear'];
    expect(canFit(inv, 'filson', { kind: 'grid', grid: g, x: 0, y: 0, rotated: false }).reason).toBe('cycle');
  });
  it('slots: carry slots take containers only, one item per slot, Pockets is not a slot; quick use takes anything', () => {
    const inv = inv0();
    expect(canFit(inv, 'tee', { kind: 'slot', slot: 'Pouch' }).reason).toBe('not-accepted');
    expect(canFit(inv, 'glasses-case', { kind: 'slot', slot: 'Pouch' }).reason).toBe('not-accepted'); // a container, but not a bag
    expect(canFit(inv, 'macbook', { kind: 'slot', slot: 'Backpack' }).reason).toBe('not-accepted'); // a bag category is not enough without panels
    expect(canFit(inv, 'tee', { kind: 'slot', slot: 'Pockets' }).ok).toBe(false);
    expect(canFit(inv, 'tee', { kind: 'slot', slot: 'Wrist' }).reason).toBe('not-accepted');
    expect(canFit(inv, 'glasses-case', { kind: 'slot', slot: 'Wrist' }).reason).toBe('occupied');
    expect(canFit(inv, 'watch', { kind: 'slot', slot: 'Wrist' }).ok).toBe(true);
    expect(canFit(inv, 'tee', { kind: 'slot', slot: 'Head' }).reason).toBe('not-accepted');
    expect(canFit(inv, 'tee', { kind: 'quickUse', index: 4 }).ok).toBe(true);
  });
  it('slot rules: strict accepts by category or tag', () => {
    const inv = inv0();
    const fits = (id: string, slot: string) => canFit(inv, id, { kind: 'slot', slot }).ok;
    expect(fits('tee', 'Torso Base')).toBe(true);
    expect(fits('tee', 'Torso Outer')).toBe(true);
    expect(fits('tee', 'Legs')).toBe(false);
    expect(fits('glasses', 'Eyes')).toBe(true);          // by tag
    expect(fits('glasses-case', 'Eyes')).toBe(false);    // accessories, no eyewear tag
    expect(fits('cable', 'Ears')).toBe(true);
    expect(fits('cable', 'Head')).toBe(false);
    expect(fits('filson', 'Torso Base')).toBe(false);
    inv.items.macbook.panels = [{ name: 'Main', grid: [1, 1] }];
    inv.items.macbook.category = 'bags and cubes';
    expect(fits('macbook', 'Pouch')).toBe(true);
    inv.loadouts.Work.slots.push('Lanyard');             // a custom slot has no rule: anything goes
    expect(fits('tee', 'Lanyard')).toBe(true);
  });
});

describe('firstFree', () => {
  it('scans rows then columns, grows the stash, null when too wide or full', () => {
    const inv = inv0();
    const v = gridView(inv, USA);
    expect(firstFree(v, [2, 2])).toEqual([0, 0]);
    expect(firstFree(v, [10, 1])).toEqual([0, 2]);
    expect(firstFree(v, [11, 1])).toBeNull();
    const pocket = gridView(inv, { kind: 'panel', in: 'glasses-case', panel: 'Main' });
    expect(firstFree(pocket, [1, 1])).toBeNull();
    expect(firstFree(pocket, [1, 1], { exclude: 'glasses' })).toEqual([0, 0]);
  });
});

describe('weights', () => {
  it('container weight is recursive with limit; carried weight counts attachments and unweighed', () => {
    const inv = inv0();
    expect(weightOf(inv, 'filson')).toEqual({ grams: 2500, unweighed: 0, limit: 2600, overLimit: false });
    expect(weightOf(inv, 'watch').grams).toBe(80);
    expect(carriedWeight(inv)).toMatchObject({ grams: 2580, unweighed: 0 });
    expect(moveItem(inv, 'tee', { kind: 'grid', grid: MAIN, x: 4, y: 0, rotated: false }, 'USA')).toBe(true);
    expect(weightOf(inv, 'filson').overLimit).toBe(true);
    expect(moveItem(inv, 'cable', { kind: 'grid', grid: { kind: 'pockets' }, x: 0, y: 0, rotated: true }, 'USA')).toBe(true);
    expect(carriedWeight(inv)).toMatchObject({ grams: 2780, unweighed: 1 });
  });
});

describe('moves', () => {
  it('a carried bag gets a loadout placement; a bag in the stash gets a home of kind panel; pockets use the virtual container', () => {
    const inv = inv0();
    moveItem(inv, 'tee', { kind: 'grid', grid: MAIN, x: 4, y: 0, rotated: false }, 'USA');
    expect(inv.loadouts.Work.placements.tee).toMatchObject({ kind: 'panel', in: 'filson', x: 4 });
    expect(inv.items.tee.home?.kind).toBe('stash');
    moveItem(inv, 'cable', { kind: 'grid', grid: { kind: 'panel', in: 'glasses-case', panel: 'Main' }, x: 0, y: 0, rotated: true }, 'USA');
    expect(inv.items.cable.home).toBeTruthy(); // not accepted (eyewear only): unchanged
    expect(inv.items.cable.home?.kind).toBe('stash');
    delete inv.loadouts.Work.placements.filson; // filson back in the stash
    moveItem(inv, 'cable', { kind: 'grid', grid: { kind: 'panel', in: 'filson', panel: 'Glasses pocket' }, x: 0, y: 0, rotated: false }, 'USA');
    expect(inv.items.cable.home).toEqual({ kind: 'panel', in: 'filson', panel: 'Glasses pocket', x: 0, y: 0, rotated: false });
    moveItem(inv, 'glasses', { kind: 'grid', grid: { kind: 'pockets' }, x: 0, y: 0, rotated: false }, 'USA');
    expect(inv.loadouts.Work.placements.glasses).toMatchObject({ kind: 'panel', in: POCKETS_ID, panel: 'Pockets' });
  });
  it('archive in sets Not Worn, out to a stash clears the status', () => {
    const inv = inv0();
    expect(moveItem(inv, 'tee', { kind: 'grid', grid: { kind: 'archive' }, x: 4, y: 0, rotated: false }, 'USA')).toBe(true);
    expect(inv.items.tee.status).toBe('Not Worn');
    expect(inv.items.tee.home?.kind).toBe('archive');
    expect(moveItem(inv, 'tee', { kind: 'grid', grid: USA, x: 0, y: 5, rotated: false }, 'USA')).toBe(true);
    expect(inv.items.tee.status).toBe('');
    archiveItem(inv, 'cable');
    expect(inv.items.cable).toMatchObject({ status: 'Not Worn', home: { kind: 'archive' } });
    expect(overlaps(inv, { kind: 'archive' })).toBe(false);
    unarchiveItem(inv, 'shirt', 'USA');
    expect(inv.items.shirt).toMatchObject({ status: '', home: { kind: 'stash', location: 'Vietnam' } });
  });
  it('sendToStash, equip, addItem', () => {
    const inv = inv0();
    expect(sendToStash(inv, 'watch', 'USA')).toBe(true);
    expect(effectivePlace(inv, 'watch')?.kind).toBe('stash');
    expect(equipItem(inv, 'tee', 'USA')).toBe(true);
    expect(inv.loadouts.Work.placements.tee).toEqual({ kind: 'slot', slot: 'Torso Base' });
    inv.items.shirt.location = 'USA';
    expect(equipItem(inv, 'shirt', 'USA')).toBe(true);    // Torso Base is taken: next preferred
    expect(inv.loadouts.Work.placements.shirt).toEqual({ kind: 'slot', slot: 'Torso Mid' });
    expect(equipItem(inv, 'glasses', 'USA')).toBe(true);  // eyewear tag beats accessories
    expect(inv.loadouts.Work.placements.glasses).toEqual({ kind: 'slot', slot: 'Eyes' });
    expect(equipItem(inv, 'watch', 'USA')).toBe(true);
    expect(inv.loadouts.Work.placements.watch).toEqual({ kind: 'slot', slot: 'Wrist' });
    expect(equipItem(inv, 'cable', 'USA')).toBe(true);    // electronics: Ears first
    expect(inv.loadouts.Work.placements.cable).toEqual({ kind: 'slot', slot: 'Ears' });
    expect(equipItem(inv, 'glasses-case', 'USA', 'Pouch')).toBe(false);
    expect(equipItem(inv, 'glasses-case', 'USA', 'Neck')).toBe(true);
    expect(addItem(inv, 'new', { name: 'New', category: 'tops' }, 'Vietnam')).toBe(true);
    expect(inv.items.new.home).toEqual({ kind: 'stash', location: 'Vietnam', x: 0, y: 0, rotated: false });
    expect(inv.items.new.location).toBe('Vietnam');
  });
  it('deleteItem: contents to the stash, attachments detached to their stash, pins and placements removed', () => {
    const inv = inv0();
    deleteItem(inv, 'filson', 'USA');
    expect(inv.items.filson).toBeUndefined();
    expect(inv.items.macbook.home?.kind).toBe('stash');
    expect(inv.quickUse[0]).toBe('macbook');
    expect(inv.loadouts.Plane.placements.filson).toBeUndefined();
    deleteItem(inv, 'watch', 'USA');
    expect(inv.items.watch).toBeUndefined();
    expect(inv.items.band.attachedTo).toBeNull();
    expect(inv.items.band.home?.kind).toBe('stash'); // band has no location: falls back to the current stash
    deleteItem(inv, 'macbook', 'USA');
    expect(inv.quickUse[0]).toBeNull();
    expect(inv.tasks[0].objectives[0].auto?.item).toBe('macbook'); // auto refs stay, they just never tick
    expect(overlaps(inv, USA)).toBe(false);
  });
});

describe('loadout switch', () => {
  it('returns items the new loadout does not place to their home, or the first free cells if it is taken', () => {
    const inv = inv0();
    // While the watch is on the wrist its home cells look free, so something else lands there.
    expect(moveItem(inv, 'cable', { kind: 'grid', grid: USA, x: 6, y: 0, rotated: false }, 'USA')).toBe(true);
    const rehomed = switchLoadout(inv, 'Plane');
    expect(inv.activeLoadout).toBe('Plane');
    expect(rehomed).toEqual(['watch']);
    expect(effectivePlace(inv, 'watch')?.kind).toBe('stash');
    expect(inv.items.watch.home).not.toMatchObject({ x: 6, y: 0 });
    expect(overlaps(inv, USA)).toBe(false);
    expect(effectivePlace(inv, 'macbook')).toMatchObject({ kind: 'panel', in: 'filson' }); // travels with the bag
    switchLoadout(inv, 'Work');
    expect(effectivePlace(inv, 'tee')).toMatchObject({ kind: 'stash', x: 3, y: 0 });
  });
});

describe('sort', () => {
  it('biggest first, then category, then name; rotates only when needed', () => {
    const inv = inv0();
    expect(sortGrid(inv, USA)).toBe(true);
    const v = gridView(inv, USA);
    const at = (id: string) => v.items.find((i) => i.id === id);
    expect(at('tee')).toMatchObject({ x: 0, y: 0 });
    expect(at('glasses-case')).toMatchObject({ x: 2, y: 0, rotated: false });
    expect(at('cable')).toMatchObject({ x: 4, y: 0, rotated: false });
    inv.items.glasses.footprint = [1, 2];
    expect(sortGrid(inv, { kind: 'panel', in: 'glasses-case', panel: 'Main' })).toBe(true);
    expect(inv.items.glasses.home).toMatchObject({ x: 0, y: 0, rotated: true });
  });
});

describe('sort modes', () => {
  const pos = (inv: Inventory) => Object.fromEntries(gridView(inv, USA).items.map((i) => [i.id, [i.x, i.y]]));
  it("size-desc packs biggest area first", () => {
    const inv = inv0();
    expect(sortGrid(inv, USA, 'size-desc')).toBe(true);
    expect(pos(inv)).toEqual({ tee: [0, 0], 'glasses-case': [2, 0], cable: [4, 0] });
  });
  it('name packs alphabetically', () => {
    const inv = inv0();
    expect(sortGrid(inv, USA, 'name')).toBe(true);
    expect(pos(inv)).toEqual({ cable: [0, 0], 'glasses-case': [1, 0], tee: [3, 0] });
    expect(overlaps(inv, USA)).toBe(false);
  });
  it('category packs in settings.categories order, then name', () => {
    const inv = inv0();
    expect(sortGrid(inv, USA, 'category')).toBe(true);
    expect(pos(inv)).toEqual({ tee: [0, 0], 'glasses-case': [2, 0], cable: [4, 0] });
  });
  it('status packs in settings.statuses order, blank last, then name', () => {
    const inv = inv0();
    inv.items.cable.status = 'Rotation';
    expect(sortGrid(inv, USA, 'status')).toBe(true);
    expect(pos(inv)).toEqual({ tee: [0, 0], cable: [2, 0], 'glasses-case': [3, 0] });
    inv.items.cable.status = '';
    expect(sortGrid(inv, USA, 'status')).toBe(true);
    expect(pos(inv)).toEqual({ tee: [0, 0], cable: [2, 0], 'glasses-case': [3, 0] });
    inv.items['glasses-case'].status = 'Seasonal';
    expect(sortGrid(inv, USA, 'status')).toBe(true);
    expect(pos(inv)).toEqual({ tee: [0, 0], 'glasses-case': [2, 0], cable: [4, 0] });
  });
});

describe('tasks', () => {
  it('auto objectives resolve from placement; checklist export', () => {
    const inv = inv0();
    const t = tasksView(inv)[0];
    expect(t.objectives.map((o) => o.done)).toEqual([true, false, true]);
    switchLoadout(inv, 'Plane');
    expect(tasksView(inv)[0].objectives[1].done).toBe(true);
    expect(taskChecklist(tasksView(inv)[0])).toBe('Pack\n[x] MacBook in the Filson\n[x] Tee worn\n[x] Loose one\n');
  });
});

describe('undo ring', () => {
  it('keeps 10 snapshots, newest first, as clones', () => {
    const r = new UndoRing<{ n: number }>(10);
    const o = { n: 0 };
    for (let i = 0; i < 12; i++) { o.n = i; r.push(o); }
    expect(r.depth).toBe(10);
    expect(r.pop()).toEqual({ n: 11 });
    const rest: number[] = [];
    for (let s = r.pop(); s; s = r.pop()) rest.push(s.n);
    expect(rest).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2]);
    expect(r.depth).toBe(0);
  });
});

describe('share (structural sharing)', () => {
  it('keeps the identity of every untouched subtree and only rebuilds the changed path', () => {
    const prev = inv0();
    const next = structuredClone(prev);
    moveItem(next, 'cable', { kind: 'grid', grid: USA, x: 0, y: 3, rotated: false }, 'USA');
    const out = share(prev, next);
    expect(out).toEqual(next);
    expect(out).not.toBe(prev);
    expect(out.items).not.toBe(prev.items);
    expect(out.items.cable).not.toBe(prev.items.cable);
    for (const id of Object.keys(prev.items)) if (id !== 'cable') expect(out.items[id]).toBe(prev.items[id]);
    expect(out.loadouts).toBe(prev.loadouts);
    expect(out.settings).toBe(prev.settings);
    expect(out.tasks).toBe(prev.tasks);
    expect(serializeInventory(out)).toBe(serializeInventory(next));
  });

  it('returns prev when nothing differs; treats key order, added and removed keys, and array length as changes', () => {
    const a = { x: 1, y: [1, 2], z: { k: 'v' } };
    expect(share(a, structuredClone(a))).toBe(a);
    const reordered = share(a, { y: [1, 2], x: 1, z: { k: 'v' } });
    expect(reordered).not.toBe(a);
    expect(Object.keys(reordered)).toEqual(['y', 'x', 'z']);
    expect(reordered.y).toBe(a.y);
    expect(share(a, { x: 1, y: [1, 2] })).not.toBe(a);
    expect(share<object>({ x: 1 }, { x: 1, w: undefined })).toEqual({ x: 1, w: undefined });
    const longer = share(a, { x: 1, y: [1, 2, 3], z: { k: 'v' } });
    expect(longer.y).toEqual([1, 2, 3]);
    expect(longer.z).toBe(a.z);
    expect(share(null, { a: 1 })).toEqual({ a: 1 });
    expect(share({ a: 1 }, [1])).toEqual([1]);
    expect(share(NaN, NaN)).toBeNaN();
  });

  it('never mutates its inputs', () => {
    const prev = inv0();
    const next = structuredClone(prev);
    next.items.tee.name = 'changed';
    const pj = JSON.stringify(prev), nj = JSON.stringify(next);
    share(prev, next);
    expect(JSON.stringify(prev)).toBe(pj);
    expect(JSON.stringify(next)).toBe(nj);
  });
});

describe('strip / serialize', () => {
  it('export has no hidden; the saved file keeps it, pretty, non-ASCII as-is, key order kept', () => {
    const inv = inv0();
    inv.items.tee.name = '棉麻上衣';
    const out = exportJson(inv);
    expect(out).not.toContain('hidden');
    expect(out).not.toContain('secret receipt');
    const saved = serializeInventory(inv);
    expect(saved).toContain('"hidden": {');
    expect(saved).toContain('棉麻上衣');
    expect(saved.endsWith('}\n')).toBe(true);
    expect(saved.split('\n')[1]).toBe('  "version": 1,');
    expect(JSON.parse(saved)).toEqual(inv);
    const crlf = serializeInventory(inv, '\r\n');
    expect(crlf.split('\r\n')).toEqual(saved.split('\n'));
  });
});

describe('images', () => {
  it('cell art priority icon -> grok -> photo -> null', () => {
    expect(imagePath({ name: 'a', category: 'x', images: { photo: 'p.jpg', grok: 'g.png' } }, 'cell')).toBe('g.png');
    expect(imagePath({ name: 'a', category: 'x', images: { photo: 'p.jpg' } }, 'cell')).toBe('p.jpg');
    expect(imagePath({ name: 'a', category: 'x', images: { icon: 'i.png', photo: 'p.jpg' } }, 'photo')).toBe('p.jpg');
    expect(imagePath({ name: 'a', category: 'x' }, 'cell')).toBeNull();
    expect(imagePath({ name: 'a', category: 'x', images: { icon: 'i.png' } }, 'worn')).toBeNull();
  });
});
