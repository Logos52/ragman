import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY, getTheme, initTheme, readStoredTheme, setTheme, toggleTheme } from './theme';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('theme', () => {
  it('defaults to light with nothing stored', () => {
    initTheme();
    expect(getTheme()).toBe('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('toggle sets data-theme="dark" on <html> and stores it; a second toggle removes both', () => {
    expect(toggleTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(toggleTheme()).toBe('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('applies the stored theme on init; an unknown stored value is light', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    initTheme();
    expect(getTheme()).toBe('dark');
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(readStoredTheme()).toBe('light');
  });

  it('blocked storage reads as light and a toggle still applies', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStoredTheme()).toBe('light');
    setTheme('dark');
    expect(getTheme()).toBe('dark');
  });

  it('index.html applies the stored theme before the app script loads', () => {
    const html = readFileSync(join(cwd(), 'index.html'), 'utf8');
    const inline = html.indexOf(`localStorage.getItem('${THEME_KEY}')`);
    expect(inline).toBeGreaterThan(-1);
    expect(inline).toBeLessThan(html.indexOf('/src/main.tsx'));
  });
});

describe('dark tokens', () => {
  const css = readFileSync(join(cwd(), 'src', 'styles', 'tokens.css'), 'utf8');
  const block = (sel: string) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
  const names = (s: string) => new Set([...s.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]));

  it('every color token of the light set is redefined in the dark set', () => {
    const light = names(block(':root {'));
    const dark = names(block(':root[data-theme="dark"]'));
    for (const t of ['--cell', '--font-label', '--font-body']) light.delete(t);
    expect([...light].filter((t) => !dark.has(t))).toEqual([]);
  });

  it('no stylesheet under src/ui hard-codes a color (all go through tokens)', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.css') ? [p] : [];
    });
    const hits: string[] = [];
    for (const f of walk(join(cwd(), 'src', 'ui'))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        // comments and alpha masks (black there means "keep", not a color) are not colors on screen
        const code = line.replace(/\/\*.*?\*\//g, '').replace(/(-webkit-)?mask:.*/, '');
        if (/#[0-9a-f]{3,8}\b|rgba?\(|\bwhite\b(?!-)|\bblack\b/i.test(code)) hits.push(`${f}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
