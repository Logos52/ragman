/**
 * Tiny drag state. Pointermove never re-renders a grid: only the zone named in `hl` (and the ghost) subscribe.
 * Every set() here is guarded so a move that lands on the same cells as before changes nothing.
 */
import { create } from 'zustand';
import type { Cell } from '../../model/types';

export interface DragGhost {
  id: string;
  rotated: boolean;
  /** Footprint after rotation, in cells. */
  w: number;
  h: number;
  /** px per cell for the ghost. */
  cell: number;
  /** Shift-drag of a stack: the ghost is the one unit being split off. */
  split?: boolean;
}

/** Ctrl-drag over a container tile: quick move into it, ok when some panel takes the item. */
export interface QuickTarget { id: string; ok: boolean }

export interface DragHighlight {
  zone: string;
  cells: Cell[];
  ok: boolean;
}

export interface DragState {
  ghost: DragGhost | null;
  /** The item being dragged; its tiles draw at 0.35 opacity. */
  sourceId: string | null;
  hl: DragHighlight | null;
  quick: QuickTarget | null;
  /** Failed drop: the source tile flashes --bad once per bump of n. */
  flash: { id: string; n: number } | null;
}

export const useDragStore = create<DragState>()(() => ({ ghost: null, sourceId: null, hl: null, quick: null, flash: null }));

/** Selector hook for a zone: its highlight, or null. Stable reference until the highlight itself changes. */
export function useZoneHighlight(zone: string): DragHighlight | null {
  return useDragStore((s) => (s.hl && s.hl.zone === zone ? s.hl : null));
}

/** The quick-move highlight for one container tile: 'ok', 'bad' or null. */
export function useQuickHighlight(id: string): 'ok' | 'bad' | null {
  return useDragStore((s) => (s.quick && s.quick.id === id ? (s.quick.ok ? 'ok' : 'bad') : null));
}
