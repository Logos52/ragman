/**
 * Stacks and "same job" reads. Pure, no mutation; the stack moves (mergeStacks, splitStack) live in moves.ts.
 *
 * A stack is a consumable item with a quantity (absent counts as 1). Two stacks are the same product when both are
 * consumable and their name, maker, color and size are equal (a blank equals only a blank: nothing is guessed).
 */
import type { Inventory, Item } from '../types';

/** How many are in a stack: quantity when it is an integer >= 1, else 1. */
export function quantityOf(item: Item | undefined): number {
  const q = item?.quantity;
  return typeof q === 'number' && Number.isInteger(q) && q >= 1 ? q : 1;
}

const blank = (v: string | null | undefined) => v ?? '';

/** Same product: both consumable, same name + maker + color + size. */
export function sameProduct(a: Item | undefined, b: Item | undefined): boolean {
  if (!a || !b || !a.consumable || !b.consumable) return false;
  return a.name === b.name && blank(a.maker) === blank(b.maker) && blank(a.color) === blank(b.color) && blank(a.size) === blank(b.size);
}

/** The id a split stack gets: `<id>-2`, `<id>-3`, ... the first one not taken. */
export function splitId(inv: Inventory, id: string): string {
  let k = 2;
  while (inv.items[`${id}-${k}`]) k++;
  return `${id}-${k}`;
}

const tagKey = (tags: string[] | undefined) => [...new Set(tags ?? [])].sort().join('\u0000');

/**
 * "Filter by item": the other items that do the same job. Same category, and when the item has tags, the same set of
 * tags (order does not matter). The item itself is not in the list. A blank category matches nothing.
 */
export function sameJob(inv: Inventory, id: string): string[] {
  const item = inv.items[id];
  if (!item || !item.category) return [];
  const key = (item.tags ?? []).length ? tagKey(item.tags) : null;
  return Object.keys(inv.items).filter((o) => {
    if (o === id) return false;
    const other = inv.items[o];
    return other.category === item.category && (key === null || tagKey(other.tags) === key);
  });
}
