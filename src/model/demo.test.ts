/**
 * The public demo (data/demo/inventory.json) must carry nothing from the private file: no id, name, maker, URL,
 * note, lesson, nickname, task text or hidden value. Runs against ../ragman-data/inventory.json when that clone is
 * beside this repo (the owner's machine) and is skipped elsewhere (CI has no private data). The demo must also
 * load and validate on its own, with no images.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import demo from '../../data/demo/inventory.json';
import { normalize } from './engine/normalize';
import type { Inventory } from './types';

const PRIVATE = resolve(__dirname, '../../../ragman-data/inventory.json');

describe('public demo data', () => {
  it('loads, normalizes and has no images, makers or hidden fields', () => {
    const inv = normalize(structuredClone(demo) as unknown as Inventory);
    expect(Object.keys(inv.items).length).toBeGreaterThan(0);
    for (const it of Object.values(inv.items)) {
      expect(it.hidden).toBeUndefined();
      expect(it.maker ?? '').toBe('');
      expect(it.makerUrl ?? '').toBe('');
      expect(it.note ?? '').toBe('');
      expect(it.images?.photo ?? it.images?.icon ?? it.images?.grok ?? it.images?.worn).toBeUndefined();
    }
  });

  it.skipIf(!existsSync(PRIVATE))('carries no string from the private inventory', () => {
    const priv = JSON.parse(readFileSync(PRIVATE, 'utf8')) as Inventory;
    const text = JSON.stringify(demo).toLowerCase();
    const secrets = new Set<string>();
    // a note that just repeats a status or location ("Not Worn") is not a secret: the settings lists are shared
    const generic = new Set([...priv.settings.statuses, ...priv.settings.categories, ...priv.settings.locations].map((s) => s.toLowerCase()));
    const add = (s: unknown) => {
      if (typeof s !== 'string' || s.trim().length < 4 || generic.has(s.trim().toLowerCase())) return;
      secrets.add(s.trim().toLowerCase());
    };
    for (const [id, it] of Object.entries(priv.items)) {
      add(id); add(it.name); add(it.nameEn); add(it.maker); add(it.makerUrl); add(it.note); add(it.lesson); add(it.nickname);
      for (const v of Object.values(it.hidden ?? {})) add(v);
      for (const v of Object.values(it.images ?? {})) add(v);
    }
    for (const t of priv.tasks ?? []) { add(t.id); add(t.title); add(t.description); for (const o of t.objectives) add(o.text); }
    const leaked = [...secrets].filter((s) => text.includes(s));
    expect(leaked).toEqual([]);
  });
});
