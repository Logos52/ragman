import { beforeEach, describe, expect, it } from 'vitest';
import { adoptInventory, getStore } from './store';
import { fixture } from './test/fixture';
import type { GridRef } from './types';

const USA: GridRef = { kind: 'stash', location: 'USA' };

describe('store', () => {
  beforeEach(() => adoptInventory(fixture()));

  it('loads normalised data and memoises reads per inv', () => {
    const s = getStore();
    expect(s.inv?.quickUse).toHaveLength(10);
    expect(s.stashLocation).toBe('USA');
    expect(s.gridView(USA)).toBe(getStore().gridView(USA));
    expect(s.carrySlots()).toEqual(['Pockets', 'Backpack', 'Pouch']);
    expect(s.carrySlots()).toBe(getStore().carrySlots());
    expect(s.slotItem('Wrist')).toBe('watch');
    expect(s.attachmentsOf('watch')).toEqual([{ slot: 'band', item: 'band' }]);
    expect(s.contentsOf('filson')).toEqual(['macbook']);
  });

  it('move: one undo step, new inv reference, perf entry, archive status in and out', () => {
    const before = getStore().inv;
    const r = getStore().move('tee', { kind: 'grid', grid: { kind: 'archive' }, x: 4, y: 0, rotated: false });
    expect(r.ok).toBe(true);
    const s = getStore();
    expect(s.inv).not.toBe(before);
    expect(s.undoDepth).toBe(1);
    expect(s.getItem('tee')?.status).toBe('Not Worn');
    expect(window.__ragmanPerf?.some((p) => p.name === 'ragman:move')).toBe(true);
    s.unarchive('tee');
    expect(getStore().getItem('tee')?.status).toBe('');
    getStore().undo();
    expect(getStore().getItem('tee')?.status).toBe('Not Worn');
  });

  it('a failed move changes nothing and adds no undo step', () => {
    const before = getStore().inv;
    const r = getStore().move('cable', { kind: 'grid', grid: USA, x: 3, y: 0, rotated: false });
    expect(r).toMatchObject({ ok: false, reason: 'occupied' });
    expect(getStore().inv).toBe(before);
    expect(getStore().undoDepth).toBe(0);
  });

  it('a mutation keeps the reference of every item it did not touch (memoised tiles skip re-render); undo too', () => {
    const before = getStore().inv!;
    getStore().move('cable', { kind: 'grid', grid: USA, x: 0, y: 3, rotated: false });
    const after = getStore().inv!;
    expect(after).not.toBe(before);
    expect(after.items.cable).not.toBe(before.items.cable);
    for (const id of Object.keys(before.items)) if (id !== 'cable') expect(after.items[id]).toBe(before.items[id]);
    getStore().undo();
    const undone = getStore().inv!;
    expect(undone).toEqual(before);
    expect(undone.items.cable).toEqual(before.items.cable);
    for (const id of Object.keys(before.items)) if (id !== 'cable') expect(undone.items[id]).toBe(after.items[id]);
  });

  it('undo is ten steps deep', () => {
    for (let i = 0; i < 12; i++) getStore().setQuickUse(1, i % 2 ? 'tee' : 'cable');
    expect(getStore().undoDepth).toBe(10);
    for (let i = 0; i < 10; i++) getStore().undo();
    expect(getStore().undoDepth).toBe(0);
    expect(getStore().inv?.quickUse[1]).toBe('tee'); // the state after step 2 of 12
    getStore().undo(); // nothing left: no-op
    expect(getStore().inv?.quickUse[1]).toBe('tee');
  });

  it('quick use stores ids once; windows keep z order; exportJson has no hidden; updateItem keeps hidden', () => {
    const s = getStore();
    s.setQuickUse(3, 'macbook');
    expect(getStore().inv?.quickUse.filter((q) => q === 'macbook')).toHaveLength(1);
    s.openWindow('filson'); s.openWindow('glasses-case'); s.raiseWindow('filson');
    expect(getStore().openWindows).toEqual(['glasses-case', 'filson']);
    s.closeWindow('glasses-case');
    expect(getStore().openWindows).toEqual(['filson']);
    s.updateItem('macbook', { note: 'n', hidden: { source: 'overwritten?' } } as Parameters<typeof s.updateItem>[1]); // an untyped caller
    expect(getStore().inv?.items.macbook.hidden).toEqual({ source: 'secret receipt' });
    expect(getStore().exportJson()).not.toContain('hidden');
    expect(getStore().exportTaskChecklist('pack').startsWith('Pack\n[x] MacBook in the Filson')).toBe(true);
  });

  it('switchLoadout, equip, filters', () => {
    getStore().setFilters({ sort: 'size-desc' });
    expect(getStore().filteredIds(USA)).toEqual(['tee', 'cable', 'glasses-case']);
    getStore().setFilters({ sort: 'name' });
    const s = getStore();
    s.switchLoadout('Plane');
    expect(getStore().activeLoadout().slots).toContain('Carry-on');
    expect(getStore().effectivePlace('watch')?.kind).toBe('stash');
    expect(getStore().equip('watch')).toBe(true);
    expect(getStore().effectivePlace('watch')).toEqual({ kind: 'slot', slot: 'Wrist' });
    getStore().setFilters({ search: 'cab' });
    expect(getStore().filteredIds(USA)).toEqual(['cable']);
  });
});

describe('store: EFT features', () => {
  beforeEach(() => adoptInventory(fixture()));

  it('flags are undoable steps; locked blocks move and delete; sameJob is memoised', () => {
    const s = getStore();
    s.setLocked('tee', true);
    expect(getStore().undoDepth).toBe(1);
    expect(getStore().move('tee', { kind: 'grid', grid: USA, x: 0, y: 6, rotated: false }).reason).toBe('locked');
    getStore().openWindow('tee');
    getStore().deleteItem('tee');
    expect(getStore().getItem('tee')).toBeDefined();
    expect(getStore().openWindows).toContain('tee');
    expect(getStore().undoDepth).toBe(1);
    getStore().setPinned('cable', true);
    getStore().setVerified('cable', true);
    getStore().setNickname('filson', 'Daily');
    expect(getStore().getItem('filson')?.nickname).toBe('Daily');
    expect(getStore().sameJob('cable')).toBe(getStore().sameJob('cable'));
    getStore().undo();
    expect(getStore().getItem('filson')?.nickname).toBeUndefined();
  });

  it('stacks: split, merge back, quick move, unlocks', () => {
    const raw = fixture();
    raw.items.vit = { name: 'Vitamin', category: 'accessories', consumable: true, quantity: 4, home: { kind: 'stash', location: 'USA', x: 0, y: 5, rotated: false } };
    raw.tasks.push({ id: 'next', title: 'Next', status: 'locked', objectives: [] });
    raw.tasks[0].unlocks = ['next'];
    adoptInventory(raw);
    const r = getStore().splitStack('vit', 1, { kind: 'grid', grid: USA, x: 1, y: 5, rotated: false });
    expect(r).toMatchObject({ ok: true, id: 'vit-2' });
    expect(getStore().quantityOf('vit')).toBe(3);
    expect(getStore().canMerge('vit-2', 'vit')).toBe(true);
    expect(getStore().move('vit-2', { kind: 'grid', grid: USA, x: 0, y: 5, rotated: false })).toMatchObject({ ok: true, merge: 'vit' });
    expect(getStore().quantityOf('vit')).toBe(4);
    expect(getStore().getItem('vit-2')).toBeUndefined();
    expect(getStore().splitStack('vit', 9).ok).toBe(false);
    expect(getStore().quickMoveInto('tee', 'filson').ok).toBe(true);
    expect(getStore().effectivePlace('tee')).toMatchObject({ kind: 'panel', in: 'filson', panel: 'Main' });
    getStore().setTaskStatus('pack', 'completed');
    expect(getStore().inv?.tasks.find((t) => t.id === 'next')?.status).toBe('active');
  });

  it('stash tabs: the open tab follows a rename, falls back to the first after a delete, and undo restores it', () => {
    const s = getStore();
    expect(s.addLocation('Storage')).toBe(true);
    s.setStashLocation('Storage');
    expect(getStore().renameLocation('Storage', ' Unit 4 ')).toBe(true);
    expect(getStore().stashLocation).toBe('Unit 4');
    getStore().undo(); // one step: settings, items and homes
    expect(getStore().inv?.settings.locations).toEqual(['USA', 'Vietnam', 'Storage']);
    expect(getStore().stashLocation).toBe('Storage');
    expect(getStore().removeLocation('Storage')).toBe(true);
    expect(getStore().stashLocation).toBe('USA');
    expect(getStore().removeLocation('Vietnam')).toBe(false); // the archived Old shirt still names it
    expect(getStore().itemsAtLocation('Vietnam')).toEqual(['shirt']);
    expect(getStore().locationNameRefusal(' usa ')).toBe('duplicate');
    expect(getStore().locationNameRefusal('USA', 'USA')).toBeNull();
    expect(getStore().locationNameRefusal('  ')).toBe('blank');
  });

  it('a full stash: Add, send to stash, a loadout switch and a drag out of the Archive refuse and change nothing', () => {
    const raw = fixture();
    raw.settings.stashRows = 4;
    delete raw.loadouts.Plane.placements.tee;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) {
      // the tee, the cable and the glasses case; the Filson's and the watch's home cells are free while Work carries them
      const taken = (x >= 3 && x <= 5 && y < 2) || (x >= 8 && y === 0);
      if (!taken) raw.items[`f${x}-${y}`] = { name: 'Filler', category: 'tops', location: 'USA', home: { kind: 'stash', location: 'USA', x, y, rotated: false } };
    }
    raw.items.vfill = { name: 'Filler', category: 'tops', footprint: [10, 4], location: 'Vietnam', home: { kind: 'stash', location: 'Vietnam', x: 0, y: 0, rotated: false } };
    raw.items.shirt.home = { kind: 'archive', x: 0, y: 0, rotated: false };
    adoptInventory(raw);
    expect(getStore().loadError).toBeNull();
    const before = getStore().inv;
    expect(getStore().addItem('new', { name: 'New', category: 'tops' })).toBe(false);
    expect(getStore().sendToStash('macbook')).toBe(false);
    expect(getStore().move('shirt', { kind: 'slot', slot: 'Torso Base' })).toMatchObject({ ok: false, reason: 'full' });
    expect(getStore().inv).toBe(before);
    expect(getStore().undoDepth).toBe(0);
    // Plane sends the watch home, but fillers took its home cells while Work had it on the wrist
    expect(getStore().switchLoadout('Plane')).toBe(false);
    expect(getStore().inv).toBe(before);
    expect(getStore().inv?.activeLoadout).toBe('Work');
  });

  it('a file whose items run past the last stash row: re-placed when there is room, named in the load error when not', () => {
    const raw = fixture();
    raw.settings.stashRows = 2;
    adoptInventory(raw);
    expect(getStore().loadError).toBe('No room in the stash for: Filson');
    expect(getStore().getItem('filson')?.home).toMatchObject({ kind: 'stash', x: 0, y: 0 });
    // more rows make the Filson fit: the banner goes with it
    expect(getStore().setStashRows(4)).toBe(true);
    expect(getStore().loadError).toBeNull();
  });

  it('a stash Sort that does not pack in its order answers false and adds no undo step', () => {
    const raw = fixture();
    raw.settings.stashWidth = 3;
    raw.settings.stashRows = 2;
    raw.settings.locations.push('Box');
    const put = (id: string, name: string, footprint: [number, number], x: number, y: number) => {
      raw.items[id] = { name, category: 'tops', footprint, location: 'Box', home: { kind: 'stash', location: 'Box', x, y, rotated: false } };
    };
    put('c', 'C', [2, 2], 0, 0);
    put('a', 'A', [1, 1], 2, 0);
    put('b', 'B', [1, 1], 2, 1);
    adoptInventory(raw);
    const box: GridRef = { kind: 'stash', location: 'Box' };
    expect(getStore().sortGrid(box, 'name')).toBe(false);
    expect(getStore().undoDepth).toBe(0);
    expect(getStore().sortGrid(box, 'size-desc')).toBe(true);
  });
});
