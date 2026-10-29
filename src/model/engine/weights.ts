/**
 * Weights. A container weighs its own weight_g plus everything in its panels and attached to it, recursively.
 * Blank weights add nothing and are counted as unweighed, never estimated.
 */
import type { Inventory, WeightSummary } from '../types';
import { buildLinks, effectivePlace, POCKETS_ID, type Links } from './place';

/** The item, its attachments and its panel contents, recursively (each id once). */
export function subtreeOf(links: Links, id: string, seen: Set<string> = new Set()): string[] {
  if (seen.has(id)) return [];
  seen.add(id);
  const out = [id];
  for (const a of links.attachments.get(id) ?? []) out.push(...subtreeOf(links, a.item, seen));
  for (const c of links.children.get(id) ?? []) out.push(...subtreeOf(links, c, seen));
  return out;
}

function sum(inv: Inventory, ids: string[]): { grams: number; unweighed: number } {
  let grams = 0, unweighed = 0;
  for (const id of ids) {
    const w = inv.items[id]?.weight_g;
    if (typeof w === 'number') grams += w; else unweighed++;
  }
  return { grams, unweighed };
}

/** A container's (or any item's) total, with its optional weightLimit_g. */
export function weightOf(inv: Inventory, id: string, links: Links = buildLinks(inv)): WeightSummary {
  const { grams, unweighed } = sum(inv, subtreeOf(links, id));
  const limit = inv.items[id]?.weightLimit_g ?? null;
  return { grams, unweighed, limit, overLimit: limit != null && grams > limit };
}

/** Ids of everything on the person in the active loadout: slots, pockets, their contents and attachments. */
export function carriedIds(inv: Inventory, links: Links = buildLinks(inv)): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of Object.keys(inv.items)) {
    if (inv.items[id].attachedTo) continue;
    const p = effectivePlace(inv, id);
    const onPerson = p && (p.kind === 'slot' || (p.kind === 'panel' && p.in === POCKETS_ID));
    if (onPerson) out.push(...subtreeOf(links, id, seen));
  }
  return out;
}

/** Total carried weight. No limit on the person. */
export function carriedWeight(inv: Inventory, links: Links = buildLinks(inv)): WeightSummary {
  return { ...sum(inv, carriedIds(inv, links)), limit: null, overLimit: false };
}
