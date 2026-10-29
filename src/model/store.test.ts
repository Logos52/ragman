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
});
