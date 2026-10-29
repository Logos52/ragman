import { useEffect, useMemo, useState } from 'react';
import type { GridRef } from '../../model/types';
import { gridKey } from '../drag/registry';

export interface RetainedGrid { key: string; ref: GridRef; active: boolean }

/**
 * The stash grids the right column keeps mounted: one per location plus the Archive. The active one mounts first;
 * the rest mount once the browser is idle after first paint, and from then on a location switch or the Archive
 * toggle only flips which one is shown (their tiles and decoded images stay). Bounded by the location list: a
 * location that leaves `settings.locations` unmounts. The active grid is always first, so it is the first
 * stash grid in DOM order. Each GridRef object is stable per key (memo and selectors are not defeated).
 */
export function useRetainedGrids(locations: readonly string[] | undefined, active: GridRef): RetainedGrid[] {
  const activeKey = gridKey(active);
  const locKey = (locations ?? []).join('\u0000');
  // every grid the column can show, as stable refs
  const all = useMemo(() => {
    const m = new Map<string, GridRef>();
    for (const location of locations ?? []) { const r: GridRef = { kind: 'stash', location }; m.set(gridKey(r), r); }
    m.set('archive', { kind: 'archive' });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey]);
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (warm) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(() => setWarm(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(h);
    }
    const t = window.setTimeout(() => setWarm(true), 200);
    return () => window.clearTimeout(t);
  }, [warm]);
  // an active ref outside the list (a stash location not in settings) is still shown, never retained
  const activeRef = all.get(activeKey) ?? active;
  return useMemo(() => {
    const out: RetainedGrid[] = [{ key: activeKey, ref: activeRef, active: true }];
    if (warm) for (const [key, ref] of all) if (key !== activeKey) out.push({ key, ref, active: false });
    return out;
  }, [all, activeKey, activeRef, warm]);
}
