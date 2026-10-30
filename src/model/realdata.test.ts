/**
 * Runs the engine over the private ragman-data clone when it sits beside this repo. Skipped when absent
 * (CI, the public repo). Read-only: nothing here writes to the data folder.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import type { GridRef, Inventory } from './types';
import { normalize } from './engine/normalize';
import { effectivePlace, gridBuckets, gridView, isContainer } from './engine/place';
import { detectEol, serializeInventory } from './engine/strip';
import { slotAccepts } from './engine/slotRules';
import { overallSummary } from './engine/overall';
import { switchLoadout } from './engine/loadout';
import { carriedIds, carriedWeight } from './engine/weights';

// vitest runs from the repo root; the data clone sits beside the repo.
const file = join(cwd(), '..', 'ragman-data', 'inventory.json');
const present = existsSync(file);

describe.skipIf(!present)('real inventory.json', () => {
  const text = present ? readFileSync(file, 'utf8') : '{}';
  const raw = JSON.parse(text) as Inventory;
  const inv = normalize(raw);

  function allGrids(): GridRef[] {
    const refs: GridRef[] = [{ kind: 'archive' }, { kind: 'pockets' }];
    for (const location of inv.settings.locations) refs.push({ kind: 'stash', location });
    for (const [id, item] of Object.entries(inv.items)) {
      if (isContainer(item)) for (const p of item.panels!) refs.push({ kind: 'panel', in: id, panel: p.name });
    }
    return refs;
  }

  it('has 73 items and every one has an effective place', () => {
    expect(Object.keys(inv.items)).toHaveLength(73);
    for (const id of Object.keys(inv.items)) expect(effectivePlace(inv, id), id).not.toBeNull();
  });

  for (const lo of Object.keys(raw.loadouts ?? {})) {
    it(`no grid has overlapping items in loadout ${lo}`, () => {
      const view = { ...inv, activeLoadout: lo };
      const buckets = gridBuckets(view);
      for (const ref of allGrids()) {
        const v = gridView(view, ref, buckets);
        const seen = new Map<string, string>();
        for (const it of v.items) {
          for (let dx = 0; dx < it.w; dx++) for (let dy = 0; dy < it.h; dy++) {
            const k = `${it.x + dx},${it.y + dy}`;
            expect(seen.get(k), `${JSON.stringify(ref)} cell ${k}: ${it.id} vs ${seen.get(k)}`).toBeUndefined();
            seen.set(k, it.id);
            expect(it.x + dx < v.width, `${it.id} inside width`).toBe(true);
          }
        }
      }
    });
  }

  it('every slot placement in every loadout obeys the slot rules', () => {
    for (const [lo, l] of Object.entries(inv.loadouts)) {
      for (const [id, p] of Object.entries(l.placements)) {
        if (p.kind !== 'slot' || !inv.items[id] || inv.items[id].attachedTo) continue;
        expect(slotAccepts(p.slot, inv.items[id]), `${lo}: ${id} in ${p.slot}`).toBe(true);
      }
    }
  });

  it('Not Worn items are drawn in the Archive', () => {
    const arch = new Set(gridView(inv, { kind: 'archive' }).items.map((v) => v.id));
    for (const [id, item] of Object.entries(inv.items)) {
      if (item.status === 'Not Worn' && item.home?.kind !== 'panel') expect(arch.has(id), id).toBe(true);
    }
  });

  it('Overall: counts add up to 73, fills are fractions, every loadout matches the footer after a switch', () => {
    const s = overallSummary(inv);
    expect(s.items).toBe(73);
    expect(s.byStatus.reduce((n, r) => n + r.count, 0)).toBe(73);
    expect(s.byLocation.reduce((n, r) => n + r.count, 0)).toBe(73);
    for (const f of s.stashes) if (f.fill !== null) expect(f.fill > 0 && f.fill <= 1, JSON.stringify(f.ref)).toBe(true);
    // a loadout not on screen is read without the settle; on this data that gives what the footer shows once switched to
    for (const lo of s.loadouts) {
      const switched = structuredClone(inv);
      switchLoadout(switched, lo.name);
      expect(lo.items, lo.name).toBe(carriedIds(switched).length);
      expect(lo.weight, lo.name).toEqual(carriedWeight(switched));
    }
  });

  it('round-trips byte for byte when nothing changed (hidden kept, line endings kept)', () => {
    expect(serializeInventory(raw, detectEol(text))).toBe(text);
  });
});
