/** The EFT inventory features: pin, lock, verified, nickname, stacks (merge/split), unlocks, sameJob, quick move. */
import { describe, expect, it } from 'vitest';
import type { DropTarget, GridRef, Inventory, Item } from '../types';
import { fixture } from '../test/fixture';
import { normalize } from './normalize';
import { effectivePlace, gridView } from './place';
import { canFit } from './fit';
import { sortGrid } from './sort';
import { exportJson, serializeInventory } from './strip';
import {
  archiveItem, deleteItem, equipItem, mergeStacks, moveItem, quickMoveInto, sendToStash, setLocked, setNickname,
  setPinned, setVerified, splitStack, unarchiveItem, updateItem,
} from './moves';
import { quantityOf, sameJob, sameProduct, splitId } from './stacks';
import { setTaskStatus, updateTask } from './tasks';

const USA: GridRef = { kind: 'stash', location: 'USA' };
const at = (grid: GridRef, x: number, y: number, rotated = false): DropTarget => ({ kind: 'grid', grid, x, y, rotated });
const inv0 = (): Inventory => normalize(fixture());

const vitamin = (x: number, quantity?: number, extra: Partial<Item> = {}): Item => ({
  name: 'Vitamin packet', maker: 'Acme', category: 'accessories', consumable: true, location: 'USA',
  ...(quantity === undefined ? {} : { quantity }), ...extra,
  home: { kind: 'stash', location: 'USA', x, y: 3, rotated: false },
});
/** Fixture plus two identical vitamin stacks at (0,3) and (1,3) of the USA stash. */
const withStacks = (): Inventory => {
  const raw = fixture();
  raw.items.vit = vitamin(0, 3);
  raw.items['vit-b'] = vitamin(1);
  return normalize(raw);
};

describe('new fields: defaults absent, never written unless set', () => {
  it('normalize adds none of them; the file round-trips; export keeps them and still strips hidden', () => {
    const raw = fixture();
    const inv = normalize(raw);
    for (const item of Object.values(inv.items)) {
      for (const k of ['pinned', 'locked', 'verified', 'nickname', 'quantity'] as const) expect(k in item).toBe(false);
    }
    for (const t of inv.tasks) expect('unlocks' in t).toBe(false);
    expect(serializeInventory(normalize(inv))).toBe(serializeInventory(inv)); // normalize writes none of them
    setPinned(inv, 'tee', true); setLocked(inv, 'cable', true); setVerified(inv, 'macbook', true); setNickname(inv, 'filson', 'Daily bag');
    inv.tasks[0].unlocks = ['next'];
    const out = JSON.parse(exportJson(inv)) as Inventory;
    expect(out.items.tee.pinned).toBe(true);
    expect(out.items.cable.locked).toBe(true);
    expect(out.items.macbook.verified).toBe(true);
    expect(out.items.macbook.hidden).toBeUndefined();
    expect(out.items.filson.nickname).toBe('Daily bag');
    expect(out.tasks[0].unlocks).toEqual(['next']);
  });
});

describe('flags', () => {
  it('true writes the key, false removes it, unchanged is a no-op', () => {
    const inv = inv0();
    expect(setPinned(inv, 'tee', false)).toBe(false);
    expect(setPinned(inv, 'tee', true)).toBe(true);
    expect(inv.items.tee.pinned).toBe(true);
    expect(setPinned(inv, 'tee', true)).toBe(false);
    expect(setPinned(inv, 'tee', false)).toBe(true);
    expect('pinned' in inv.items.tee).toBe(false);
    expect(setVerified(inv, 'tee', true)).toBe(true);
    expect(setVerified(inv, 'nope', true)).toBe(false);
  });
  it('nickname: containers only, trimmed, blank removes it', () => {
    const inv = inv0();
    expect(setNickname(inv, 'tee', 'Shirt')).toBe(false);
    expect('nickname' in inv.items.tee).toBe(false);
    expect(setNickname(inv, 'filson', '  Daily bag ')).toBe(true);
    expect(inv.items.filson.nickname).toBe('Daily bag');
    expect(setNickname(inv, 'filson', 'Daily bag')).toBe(false);
    expect(setNickname(inv, 'filson', '  ')).toBe(true);
    expect('nickname' in inv.items.filson).toBe(false);
    expect(setNickname(inv, 'filson', null)).toBe(false);
    expect(updateItem(inv, 'tee', { nickname: 'x' }, 'USA')).toBe(false);
    expect(updateItem(inv, 'filson', { nickname: 'Bag' }, 'USA')).toBe(true);
    expect(updateItem(inv, 'filson', { nickname: '' }, 'USA')).toBe(true);
    expect('nickname' in inv.items.filson).toBe(false);
  });
});

describe('locked', () => {
  it('cannot be moved, equipped, archived, unarchived, sent to stash or deleted; Quick Use is still allowed', () => {
    const inv = inv0();
    setLocked(inv, 'tee', true);
    const before = structuredClone(inv);
    const f = canFit(inv, 'tee', at(USA, 0, 6));
    expect(f).toEqual({ ok: false, cells: [[0, 6], [1, 6], [0, 7], [1, 7]], reason: 'locked' });
    expect(canFit(inv, 'tee', { kind: 'slot', slot: 'Torso Base' }).reason).toBe('locked');
    expect(canFit(inv, 'tee', { kind: 'quickUse', index: 3 }).ok).toBe(true);
    expect(moveItem(inv, 'tee', at(USA, 0, 6), 'USA')).toBe(false);
    expect(equipItem(inv, 'tee', 'USA')).toBe(false);
    expect(archiveItem(inv, 'tee')).toBe(false);
    expect(sendToStash(inv, 'tee', 'Vietnam')).toBe(false);
    expect(unarchiveItem(inv, 'tee', 'USA')).toBe(false);
    expect(deleteItem(inv, 'tee', 'USA')).toBe(false);
    expect(updateItem(inv, 'tee', { status: 'Not Worn' }, 'USA')).toBe(false);
    expect(updateItem(inv, 'tee', { location: 'Vietnam' }, 'USA')).toBe(false);
    expect(inv).toEqual(before);
    expect(updateItem(inv, 'tee', { note: 'fine' }, 'USA')).toBe(true);
    expect(moveItem(inv, 'tee', { kind: 'quickUse', index: 3 }, 'USA')).toBe(true);
    setLocked(inv, 'tee', false);
    expect(moveItem(inv, 'tee', at(USA, 0, 6), 'USA')).toBe(true);
  });
  it('a container cannot be deleted while it would have to move a locked item out; a locked item travels with its bag', () => {
    const inv = inv0();
    setLocked(inv, 'macbook', true);
    expect(deleteItem(inv, 'filson', 'USA')).toBe(false);
    expect(inv.items.filson).toBeDefined();
    inv.loadouts.Work.placements = {}; // the Filson back in the stash
    expect(moveItem(inv, 'filson', at(USA, 0, 6), 'USA')).toBe(true);
    expect(effectivePlace(inv, 'macbook')).toMatchObject({ kind: 'panel', in: 'filson' });
  });
});

describe('sort with pinned and locked', () => {
  it('pinned and locked items stay put; the rest pack around them', () => {
    const inv = inv0();
    inv.loadouts.Work.placements = {}; // the Filson (3x4) and the watch (2x2) sit in the USA stash
    moveItem(inv, 'tee', at(USA, 0, 8), 'USA');
    setPinned(inv, 'tee', true);
    moveItem(inv, 'cable', at(USA, 9, 9), 'USA');
    setLocked(inv, 'cable', true);
    expect(sortGrid(inv, USA, 'size-desc')).toBe(true);
    expect(inv.items.tee.home).toMatchObject({ x: 0, y: 8 });
    expect(inv.items.cable.home).toMatchObject({ x: 9, y: 9 });
    expect(inv.items.filson.home).toMatchObject({ x: 0, y: 0 });
    const seen = new Set<string>();
    for (const v of gridView(inv, USA).items) for (let dx = 0; dx < v.w; dx++) for (let dy = 0; dy < v.h; dy++) {
      const k = `${v.x + dx},${v.y + dy}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });
});

describe('stacks', () => {
  it('quantity: absent is 1; same product = consumable + name, maker, color, size', () => {
    const inv = withStacks();
    expect(quantityOf(inv.items['vit-b'])).toBe(1);
    expect(quantityOf(inv.items.vit)).toBe(3);
    expect(sameProduct(inv.items.vit, inv.items['vit-b'])).toBe(true);
    expect(sameProduct(inv.items.vit, { ...inv.items['vit-b'], color: 'Red' })).toBe(false);
    expect(sameProduct(inv.items.vit, { ...inv.items['vit-b'], consumable: false })).toBe(false);
    expect(sameProduct(inv.items.tee, inv.items.tee)).toBe(false);
    expect(updateItem(inv, 'tee', { quantity: 2 }, 'USA')).toBe(false);
    expect(updateItem(inv, 'vit', { quantity: 0 }, 'USA')).toBe(false);
    expect(updateItem(inv, 'vit', { quantity: 2.5 }, 'USA')).toBe(false);
    expect(updateItem(inv, 'vit', { quantity: 5 }, 'USA')).toBe(true);
    expect(updateItem(inv, 'vit', { quantity: undefined }, 'USA')).toBe(true);
    expect('quantity' in inv.items.vit).toBe(false);
  });
  it('dropping a stack on an identical stack merges; pins and task links follow', () => {
    const inv = withStacks();
    inv.quickUse[4] = 'vit-b';
    inv.tasks[0].objectives[2].auto = { item: 'vit-b', in: 'filson' };
    const f = canFit(inv, 'vit-b', at(USA, 0, 3));
    expect(f).toMatchObject({ ok: true, merge: 'vit' });
    expect(canFit(inv, 'tee', at(USA, 0, 2)).reason).toBe('occupied'); // not a stack: still occupied
    expect(moveItem(inv, 'vit-b', at(USA, 0, 3), 'USA')).toBe(true);
    expect(inv.items['vit-b']).toBeUndefined();
    expect(inv.items.vit.quantity).toBe(4);
    expect(inv.quickUse[4]).toBe('vit');
    expect(inv.tasks[0].objectives[2].auto?.item).toBe('vit');
  });
  it('no merge onto a locked stack, a different product, or two items at once', () => {
    const inv = withStacks();
    setLocked(inv, 'vit', true);
    expect(canFit(inv, 'vit-b', at(USA, 0, 3)).reason).toBe('occupied');
    expect(mergeStacks(inv, 'vit-b', 'vit', 'USA')).toBe(false);
    setLocked(inv, 'vit', false);
    expect(mergeStacks(inv, 'vit', 'vit', 'USA')).toBe(false);
    expect(mergeStacks(inv, 'vit', 'tee', 'USA')).toBe(false);
    expect(mergeStacks(inv, 'vit', 'vit-b', 'USA')).toBe(true);
    expect(inv.items['vit-b'].quantity).toBe(4);
  });
  it('split: a new id with a numeric suffix carrying n, placed at the target', () => {
    const inv = withStacks();
    expect(splitId(inv, 'vit')).toBe('vit-2');
    const r = splitStack(inv, 'vit', 2, 'USA', at(USA, 0, 4));
    expect(r).toMatchObject({ ok: true, id: 'vit-2' });
    expect(inv.items.vit.quantity).toBe(1);
    expect(inv.items['vit-2']).toMatchObject({ quantity: 2, name: 'Vitamin packet', home: { kind: 'stash', x: 0, y: 4 } });
    expect(splitId(inv, 'vit')).toBe('vit-3');
  });
  it('split: default target is the first free cells of the same grid; pockets also get a stash home', () => {
    const inv = withStacks();
    const r = splitStack(inv, 'vit', 1, 'USA');
    expect(r.ok).toBe(true);
    expect(effectivePlace(inv, r.id!)).toMatchObject({ kind: 'stash', location: 'USA' });
    const p = splitStack(inv, 'vit', 1, 'USA', at({ kind: 'pockets' }, 0, 0));
    expect(p.ok).toBe(true);
    expect(effectivePlace(inv, p.id!)).toMatchObject({ kind: 'panel', in: '__pockets__' });
    expect(inv.items[p.id!].home?.kind).toBe('stash');
    expect(inv.items.vit.quantity).toBe(1);
  });
  it('split: refused for a bad n, a locked or non-consumable item, a target that does not fit or is itself', () => {
    const inv = withStacks();
    const before = structuredClone(inv);
    expect(splitStack(inv, 'vit', 3, 'USA').ok).toBe(false);
    expect(splitStack(inv, 'vit', 0, 'USA').ok).toBe(false);
    expect(splitStack(inv, 'vit-b', 1, 'USA').ok).toBe(false);
    expect(splitStack(inv, 'tee', 1, 'USA').ok).toBe(false);
    expect(splitStack(inv, 'vit', 1, 'USA', at(USA, 3, 0)).reason).toBe('occupied');
    expect(splitStack(inv, 'vit', 1, 'USA', at(USA, 0, 3)).reason).toBe('occupied'); // onto itself
    setLocked(inv, 'vit', true);
    expect(splitStack(inv, 'vit', 1, 'USA').reason).toBe('locked');
    setLocked(inv, 'vit', false);
    expect(inv).toEqual(before);
  });
  it('split onto an identical stack moves n into it', () => {
    const inv = withStacks();
    const r = splitStack(inv, 'vit', 2, 'USA', at(USA, 1, 3));
    expect(r).toMatchObject({ ok: true, id: 'vit-b' });
    expect(inv.items.vit.quantity).toBe(1);
    expect(inv.items['vit-b'].quantity).toBe(3);
    expect(inv.items['vit-2']).toBeUndefined();
  });
});

describe('task unlocks', () => {
  it('completing a task makes every locked task it lists active', () => {
    const inv = inv0();
    inv.tasks[0].unlocks = ['b', 'c', 'gone'];
    inv.tasks.push(
      { id: 'b', title: 'B', status: 'locked', objectives: [] },
      { id: 'c', title: 'C', status: 'completed', objectives: [] },
      { id: 'd', title: 'D', status: 'locked', objectives: [] },
    );
    expect(setTaskStatus(inv, 'pack', 'active')).toBe(false);
    expect(setTaskStatus(inv, 'pack', 'completed')).toBe(true);
    expect(inv.tasks.map((t) => t.status)).toEqual(['completed', 'active', 'completed', 'locked']);
    inv.tasks[1].unlocks = ['d'];
    expect(updateTask(inv, 'b', { status: 'completed' })).toBe(true);
    expect(inv.tasks[3].status).toBe('active');
  });
});

describe('sameJob', () => {
  it('same category, and the same tag set when the item has tags; not itself', () => {
    const inv = inv0();
    expect(sameJob(inv, 'cable')).toEqual(['macbook']); // the cable has no tags: category alone
    expect(sameJob(inv, 'tee')).toEqual(['shirt']);
    expect(sameJob(inv, 'watch')).toEqual(['band', 'glasses-case', 'glasses']);
    expect(sameJob(inv, 'band')).toEqual([]); // tagged band: no other accessory has exactly [band]
    inv.items.ipad = { name: 'iPad', category: 'electronics', tags: ['flat', 'laptop'], home: { kind: 'stash', location: 'USA', x: 0, y: 6, rotated: false } };
    expect(sameJob(inv, 'macbook')).toEqual(['ipad']);
    expect(sameJob(inv, 'nope')).toEqual([]);
  });
});

describe('quickMoveInto', () => {
  it('first free cells of the first panel that accepts the item', () => {
    const inv = inv0();
    inv.loadouts.Work.placements = {}; // the Filson in the stash
    const r = quickMoveInto(inv, 'tee', 'filson', 'USA');
    expect(r.ok).toBe(true);
    expect(inv.items.tee.home).toMatchObject({ kind: 'panel', in: 'filson', panel: 'Main', x: 4, y: 0 });
    // The glasses case takes only eyewear: the tee is not accepted anywhere.
    expect(quickMoveInto(inv, 'cable', 'glasses-case', 'USA').reason).toBe('not-accepted');
    expect(quickMoveInto(inv, 'tee', 'tee', 'USA').reason).toBe('not-accepted'); // not a container
    expect(quickMoveInto(inv, 'filson', 'filson', 'USA').reason).toBe('self');
  });
  it('skips a full panel and uses the next; reasons occupied and locked', () => {
    const inv = inv0();
    inv.items.glasses.home = { kind: 'stash', location: 'USA', x: 0, y: 8, rotated: false };
    inv.items.glasses2 = { name: 'Glasses 2', category: 'accessories', tags: ['eyewear'], footprint: [2, 1], home: { kind: 'stash', location: 'USA', x: 2, y: 8, rotated: false } };
    expect(quickMoveInto(inv, 'glasses', 'glasses-case', 'USA').ok).toBe(true);
    expect(quickMoveInto(inv, 'glasses2', 'glasses-case', 'USA').reason).toBe('occupied');
    inv.items.case2 = {
      name: 'Case 2', category: 'accessories', home: { kind: 'stash', location: 'USA', x: 4, y: 8, rotated: false },
      panels: [{ name: 'Lid', grid: [1, 1], accepts: null }, { name: 'Main', grid: [2, 1], accepts: ['eyewear'] }],
    };
    expect(quickMoveInto(inv, 'glasses2', 'case2', 'USA').ok).toBe(true);
    expect(inv.items.glasses2.home).toMatchObject({ in: 'case2', panel: 'Main' }); // 2x1 does not fit the 1x1 Lid
    setLocked(inv, 'tee', true);
    expect(quickMoveInto(inv, 'tee', 'case2', 'USA').reason).toBe('locked');
  });
});
