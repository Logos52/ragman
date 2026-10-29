/**
 * Structural sharing for JSON-shaped data (plain objects, arrays, primitives, null).
 *
 * `share(prev, next)` returns a value deep-equal to `next` in which every subtree that is deep-equal to the
 * matching subtree of `prev` IS that prev subtree (same reference). The store mutates a full structuredClone
 * draft, then shares it against the previous inv, so an item, placement or loadout the engine did not touch
 * keeps its identity and memoised React components (ItemTile) skip re-rendering.
 *
 * Equality is strict: same keys in the same order (so a JSON export of the result is byte-identical to one of
 * `next`), same array lengths, same primitives (Object.is). Neither input is mutated.
 */
type Json = unknown;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function share<T>(prev: Json, next: T): T {
  if (Object.is(prev, next)) return next;
  if (Array.isArray(next)) {
    if (!Array.isArray(prev)) return next;
    let same = prev.length === next.length;
    const out = next.map((v, i) => {
      const s = share(prev[i], v);
      if (s !== prev[i]) same = false;
      return s;
    });
    return (same ? prev : out) as T;
  }
  if (isObj(next)) {
    if (!isObj(prev)) return next;
    const nk = Object.keys(next);
    const pk = Object.keys(prev);
    let same = nk.length === pk.length;
    const out: Record<string, unknown> = {};
    nk.forEach((k, i) => {
      if (pk[i] !== k) same = false;
      const s = Object.prototype.hasOwnProperty.call(prev, k) ? share(prev[k], next[k]) : next[k];
      if (s !== prev[k] || !(k in prev)) same = false;
      out[k] = s;
    });
    return (same ? prev : out) as T;
  }
  return next;
}
