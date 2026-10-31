/**
 * Light or dark theme. The theme is `data-theme="dark"` on <html> (absent = light) and is kept per browser in
 * localStorage under "ragman:theme". index.html applies the stored value before first paint; this module reads it
 * back, applies changes and tells React about them. Every storage read and write is in try/catch: blocked storage
 * means light, and a toggle still works for the page's life.
 */
import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'ragman:theme';

const listeners = new Set<() => void>();

/** The stored theme; anything but "dark" (or no storage at all) is light. */
export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** The theme on <html> right now. */
export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Put the theme on <html>, without storing it. */
export function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  if (theme === 'dark') el.dataset.theme = 'dark';
  else delete el.dataset.theme;
}

/** Apply and store the theme, then tell subscribers. */
export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    if (theme === 'dark') localStorage.setItem(THEME_KEY, 'dark');
    else localStorage.removeItem(THEME_KEY);
  } catch {
    /* storage blocked: the theme holds until reload */
  }
  for (const fn of listeners) fn();
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Apply the stored theme (index.html already did this; this covers a page loaded without that script). */
export function initTheme(): void {
  applyTheme(readStoredTheme());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The current theme for a React component; re-renders on every change. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'light');
}
