import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

export interface TooltipProps {
  /** Pointer position in viewport px; the box is placed below-right of it and kept on screen. */
  x: number;
  y: number;
  children: ReactNode;
  /** Render in place instead of into document.body (used by the gallery). */
  inline?: boolean;
  /** Elements the box must not cover besides the reserved-region labels (the hovered tile's own name strip). */
  avoid?: () => Element[];
}

const OFFSET_X = 14;
const OFFSET_Y = 18;
const MARGIN = 8;

type Rect = { left: number; top: number; right: number; bottom: number; width: number };

function hits(rects: Rect[], left: number, top: number, width: number, height: number): boolean {
  return rects.some((r) => r.width > 0 && r.left < left + width && r.right > left && r.top < top + height && r.bottom > top);
}

export function Tooltip({ x, y, children, inline, avoid }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + OFFSET_X, top: y + OFFSET_Y });

  // Measure once per pointer position / content. The box is width: max-content, so its size
  // does not depend on where it sits; clamping into the viewport therefore cannot re-trigger.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || inline) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // what the box must never cover: reserved-region labels and the hovered tile's name strip (a few elements, cheap)
    const keepClear: Rect[] = [...document.querySelectorAll('.rg-grid__region-label'), ...(avoid?.() ?? [])]
      .map((e) => e.getBoundingClientRect());
    const clampX = (l: number) => Math.round(Math.min(Math.max(MARGIN, l), Math.max(MARGIN, vw - MARGIN - width)));
    const fitsY = (t: number) => t >= MARGIN && t + height <= vh - MARGIN;
    // below-right of the pointer (left of it when the right edge would cut it off); then above it; then beside it,
    // vertically centred on the pointer, right and then left. The first spot on screen that covers nothing wins.
    const hx = clampX(x + OFFSET_X + width > vw - MARGIN ? x - width - 6 : x + OFFSET_X);
    const mid = Math.round(y - height / 2);
    const spots = [
      { left: hx, top: y + OFFSET_Y },
      { left: hx, top: y - height - 6 },
      ...(x + OFFSET_X + width <= vw - MARGIN ? [{ left: x + OFFSET_X, top: mid }] : []),
      ...(x - OFFSET_X - width >= MARGIN ? [{ left: x - OFFSET_X - width, top: mid }] : []),
    ].filter((p) => fitsY(p.top));
    const pick = spots.find((p) => !hits(keepClear, p.left, p.top, width, height)) ?? spots[0]
      ?? { left: hx, top: y + OFFSET_Y + height > vh - MARGIN ? y - height - 6 : y + OFFSET_Y };
    const left = clampX(pick.left);
    const top = Math.round(Math.min(Math.max(MARGIN, pick.top), Math.max(MARGIN, vh - MARGIN - height)));
    setPos((p) => (p.left === left && p.top === top ? p : { left, top }));
  }, [x, y, children, inline, avoid]);

  const box = (
    <div ref={ref} role="tooltip" className={inline ? 'rg-tooltip rg-tooltip--inline' : 'rg-tooltip'} style={inline ? undefined : pos}>
      {children}
    </div>
  );
  return inline ? box : createPortal(box, document.body);
}

/** Title line for tooltips: condensed caps 13 px. */
export function TooltipTitle({ children }: { children: ReactNode }) {
  return <div className="rg-tooltip__title">{children}</div>;
}

export interface HoverTooltipState {
  open: boolean;
  x: number;
  y: number;
}

export interface HoverTooltipHandlers {
  onPointerEnter: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
}

/**
 * Hover tooltip with a 160 ms delay. Spread `handlers` on the target; render
 * `{state.open && <Tooltip x={state.x} y={state.y}>…</Tooltip>}`. Pressing hides it.
 */
export function useHoverTooltip(delay = 160): { state: HoverTooltipState; handlers: HoverTooltipHandlers; hide: () => void } {
  const [state, setState] = useState<HoverTooltipState>({ open: false, x: 0, y: 0 });
  const timer = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  const clear = () => {
    if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null; }
  };
  const hide = useCallback(() => { clear(); setState((s) => (s.open ? { ...s, open: false } : s)); }, []);

  useEffect(() => clear, []);

  const handlers: HoverTooltipHandlers = {
    onPointerEnter: (e) => {
      if (e.pointerType === 'touch') return;
      last.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setState({ open: true, ...last.current });
      }, delay);
    },
    onPointerMove: (e) => {
      if (e.pointerType === 'touch') return;
      last.current = { x: e.clientX, y: e.clientY };
      setState((s) => (s.open ? { open: true, x: e.clientX, y: e.clientY } : s));
    },
    onPointerLeave: hide,
    onPointerDown: hide,
  };
  return { state, handlers, hide };
}
