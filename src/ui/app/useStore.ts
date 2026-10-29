/**
 * Small helpers the shell uses to read the inventory store.
 * Subscribing to `inv` (and `imagesTick`) re-renders on every mutation; the
 * read methods themselves are called on getStore() in render (they are pure and memoised).
 */
import { getStore, useInventory } from '../../model/store';

export { getStore, useInventory };

/** The loaded inventory (null until boot finishes). Re-renders on every mutation. */
export function useInv() {
  return useInventory((s) => s.inv);
}

/** Re-render when image URLs resolve or a pasted image is saved. */
export function useImagesTick() {
  return useInventory((s) => s.imagesTick);
}

/** "4 × 3" for a stored footprint; '' when blank. */
export function fmtCells(c: [number, number] | null | undefined): string {
  return c ? `${c[0]} × ${c[1]}` : '';
}

/** "312 g"; '' when blank. */
export function fmtGrams(g: number | null | undefined): string {
  return g == null ? '' : `${g} g`;
}

/** kebab-case slug; '' when nothing ascii is left. */
export function kebab(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Slug not in `taken`, suffixing -2, -3, ... when needed. */
export function uniqueSlug(base: string, taken: (id: string) => boolean): string {
  const b = base || 'item';
  if (!taken(b)) return b;
  for (let n = 2; ; n++) if (!taken(`${b}-${n}`)) return `${b}-${n}`;
}

/** True when keyboard focus is in a text entry (Ctrl-Z there is the field's own undo). */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
