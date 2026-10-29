/**
 * Slot rules, strict like EFT: each body slot takes only the categories or tags listed here.
 * Names match an item's category or any of its tags (the same matching as a panel's accepts).
 * Carry slots (Backpack, Carry-on, Pouch) additionally require the item to be a container.
 * A slot not in SLOT_ACCEPTS (a custom slot added to one loadout) takes anything; Pockets is never a slot target.
 * Documented in docs/ARCHITECTURE.md; keep the two in step.
 */
import type { Inventory, Item } from '../types';
import { isContainer } from './place';

export const BAG_CATEGORY = 'bags and cubes';

/** Slots that take only containers. Pockets is a grid, never a slot target. */
export const CONTAINER_SLOTS = ['Backpack', 'Carry-on', 'Pouch'];

export const SLOT_ACCEPTS: Record<string, string[]> = {
  Head: ['accessories'],
  Eyes: ['eyewear'],
  Ears: ['electronics', 'accessories'],
  Neck: ['accessories'],
  Wrist: ['accessories', 'electronics'],
  'Torso Base': ['tops'],
  'Torso Mid': ['tops'],
  'Torso Outer': ['outerwear', 'tops'],
  Hands: ['accessories'],
  Legs: ['bottoms'],
  Underwear: ['underwear'],
  Socks: ['underwear', 'accessories'],
  Feet: ['footwear'],
  Backpack: [BAG_CATEGORY],
  'Carry-on': [BAG_CATEGORY],
  Pouch: [BAG_CATEGORY],
};

/** equip() without a slot tries these first, in order; tags are consulted before the category. */
export const PREFERRED_SLOTS: Record<string, string[]> = {
  tops: ['Torso Base', 'Torso Mid', 'Torso Outer'],
  outerwear: ['Torso Outer'],
  bottoms: ['Legs'],
  underwear: ['Underwear', 'Socks'],
  footwear: ['Feet'],
  eyewear: ['Eyes'],
  electronics: ['Ears', 'Wrist'],
  accessories: ['Wrist', 'Neck', 'Head', 'Hands'],
  [BAG_CATEGORY]: ['Backpack', 'Carry-on', 'Pouch'],
};

const namesOf = (item: Item) => [...(item.tags ?? []), item.category];

/** Does `slot` accept `item` by the rules (ignores occupancy and the loadout's slot list)? */
export function slotAccepts(slot: string, item: Item): boolean {
  if (CONTAINER_SLOTS.includes(slot) && !isContainer(item)) return false;
  const list = SLOT_ACCEPTS[slot];
  if (!list) return true;
  const names = namesOf(item);
  return list.some((n) => names.includes(n));
}

/** Slot order equip() tries for an item: its preferred slots (tags first, then category), then every other slot of the loadout. */
export function equipOrder(inv: Inventory, item: Item): string[] {
  const lo = inv.loadouts[inv.activeLoadout];
  if (!lo) return [];
  const preferred: string[] = [];
  for (const n of namesOf(item)) for (const s of PREFERRED_SLOTS[n] ?? []) if (!preferred.includes(s)) preferred.push(s);
  const inLoadout = preferred.filter((s) => lo.slots.includes(s));
  return [...inLoadout, ...lo.slots.filter((s) => !inLoadout.includes(s))];
}
