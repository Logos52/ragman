/**
 * Rule: the UI never reads item.hidden. Greps src/ui (if it exists yet) for `hidden.` and `.hidden`
 * outside comments and fails on any hit.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const uiDir = join(cwd(), 'src', 'ui'); // vitest runs from the repo root

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p)); else out.push(p);
  }
  return out;
}

/** Remove block comments, then line comments (a `//` not inside a URL like https://). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('UI never reads item.hidden', () => {
  it('src/ui has no `hidden.` or `.hidden` outside comments', () => {
    if (!existsSync(uiDir)) return; // the UI is not written yet
    const hits: string[] = [];
    for (const f of files(uiDir)) {
      const lines = stripComments(readFileSync(f, 'utf8')).split('\n');
      lines.forEach((l, i) => { if (l.includes('hidden.') || l.includes('.hidden')) hits.push(`${f}:${i + 1}: ${l.trim()}`); });
    }
    expect(hits).toEqual([]);
  });
});
