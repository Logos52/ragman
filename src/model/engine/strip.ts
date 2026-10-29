/**
 * Serialisation. The saved file keeps everything, `hidden` included, in the original key order
 * (JSON.stringify keeps insertion order and non-ASCII as-is). The export strips `hidden` from every item.
 */
import type { Inventory } from '../types';

export type Eol = '\n' | '\r\n';

/** The line ending a loaded file uses, so a save does not rewrite every line of a CRLF checkout. */
export function detectEol(text: string): Eol {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * What persist writes: 2-space pretty print plus a trailing newline, in the file's own line ending.
 * Round-trips `hidden` untouched. (JSON string values never hold a raw newline, so the EOL swap is safe.)
 */
export function serializeInventory(inv: Inventory, eol: Eol = '\n'): string {
  const text = JSON.stringify(inv, null, 2);
  return (eol === '\n' ? text : text.replace(/\n/g, eol)) + eol;
}

/** The user-facing JSON export: same shape, no `hidden` anywhere. The EFT fields (pinned, locked, verified, nickname,
 * quantity, task unlocks) are kept exactly as set; none is added. */
export function exportJson(inv: Inventory): string {
  const items: Inventory['items'] = {};
  for (const [id, item] of Object.entries(inv.items)) {
    const { hidden: _drop, ...rest } = item;
    void _drop;
    items[id] = rest;
  }
  return JSON.stringify({ ...inv, items }, null, 2) + '\n';
}
