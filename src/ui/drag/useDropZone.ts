import { useEffect, useRef } from 'react';
import type { GridRef } from '../../model/types';
import { registerZone, type ZoneKind } from './registry';

export interface ZoneSpec {
  kind: ZoneKind;
  grid?: GridRef;
  slot?: string;
  index?: number;
  width?: number;
  height?: number;
  cellSize: number;
}

/**
 * Registers a drop zone while mounted. `find` picks the zone element from the wrapper
 * (the primitives do not forward refs, so the wrapper ref + a selector reaches the box).
 */
export function useDropZone<T extends HTMLElement>(key: string, spec: ZoneSpec, selector?: string) {
  const ref = useRef<T>(null);
  const { kind, grid, slot, index, width, height, cellSize } = spec;
  const gridJson = grid ? JSON.stringify(grid) : '';
  useEffect(() => {
    const wrap = ref.current;
    if (!wrap) return;
    const el = (selector ? wrap.querySelector<HTMLElement>(selector) : wrap) ?? wrap;
    el.setAttribute('data-zone', key);
    const off = registerZone({ key, element: el, kind, grid, slot, index, width, height, cellSize });
    return () => { off(); el.removeAttribute('data-zone'); };
    // grid is compared by value through gridJson
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind, gridJson, slot, index, width, height, cellSize, selector]);
  return ref;
}
