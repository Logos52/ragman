/**
 * Every grid, slot box and quick-use box registers here while mounted. The drag system hit-tests
 * the registry on pointermove: the zone under the pointer is found with elementFromPoint (respects
 * scroll clipping and window stacking), falling back to a bounding-rect scan.
 */
import type { GridRef } from '../../model/types';

export type ZoneKind = 'grid' | 'slot' | 'quickUse';

export interface DropZone {
  key: string;
  /** The element whose box is the zone (the grid surface, the slot box). */
  element: HTMLElement;
  kind: ZoneKind;
  grid?: GridRef;
  slot?: string;
  index?: number;
  /** Grid size in cells (grid zones). */
  width?: number;
  height?: number;
  /** px per cell as rendered (kept current by the zone; geometry falls back to the rect). */
  cellSize: number;
}

const zones = new Map<string, DropZone>();

export const ZONE_ATTR = 'data-zone';

export function registerZone(zone: DropZone): () => void {
  zones.set(zone.key, zone);
  return () => { if (zones.get(zone.key) === zone) zones.delete(zone.key); };
}

export function getZone(key: string): DropZone | undefined {
  return zones.get(key);
}

export function zoneAt(x: number, y: number): DropZone | null {
  const hit = document.elementFromPoint(x, y);
  const el = hit instanceof Element ? hit.closest(`[${ZONE_ATTR}]`) : null;
  if (el) {
    const z = zones.get(el.getAttribute(ZONE_ATTR) ?? '');
    if (z) return z;
  }
  if (hit) return null; // something else (a header, a gap) is on top: no zone
  for (const z of zones.values()) {
    const r = z.element.getBoundingClientRect();
    if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return z;
  }
  return null;
}

/** Stable string key for a grid ref (zone keys, React keys). */
export function gridKey(ref: GridRef): string {
  switch (ref.kind) {
    case 'stash': return `stash:${ref.location}`;
    case 'archive': return 'archive';
    case 'pockets': return 'pockets';
    case 'panel': return `panel:${ref.in}:${ref.panel}`;
  }
}
