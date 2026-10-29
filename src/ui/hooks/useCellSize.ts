import { useSyncExternalStore } from 'react';

/** The --cell token in px, read once and again on resize (it changes at the 1280 / 640 px breakpoints). */
let cell = 0;
const subs = new Set<() => void>();

function read(): number {
  if (typeof window === 'undefined') return 56;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell'));
  return Number.isFinite(v) && v > 0 ? v : 56;
}

let listening = false;
function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('resize', () => {
    const next = read();
    if (next !== cell) { cell = next; subs.forEach((f) => f()); }
  });
}

/** Current cell size in px without subscribing (drag code). */
export function getCellSize(): number {
  if (!cell) { cell = read(); listen(); }
  return cell;
}

export function useCellSize(): number {
  return useSyncExternalStore(
    (f) => { listen(); subs.add(f); return () => { subs.delete(f); }; },
    getCellSize,
    () => 56,
  );
}
