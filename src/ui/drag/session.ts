/**
 * Pointer-event drag session (no HTML5 drag and drop).
 * pointerdown on a tile -> 4 px threshold -> drag: the ghost follows the pointer via transform, the zone
 * under the pointer is hit-tested from the registry, the target cell comes from geometry (the ghost's
 * top-left cell), canFit decides green/red. R rotates, Esc cancels. pointerup drops or snaps back.
 *
 * EFT modifiers: Ctrl held over a container TILE (not its grid) quick-moves into it (quickMoveInto), the tile lit
 * --ok/--bad; Shift at the start of a drag of a stack (quantity > 1) splits exactly one unit off (splitStack(id, 1,
 * target)) and leaves the rest; a drop onto an identical stack merges (move() does it, canFit answers `merge`) and
 * lights that stack's cells --ok.
 * A locked item never starts a drag: crossing the threshold flashes it --bad instead.
 * Attach: dropping an item on the TILE of an item whose attachment slot takes it (a band on the watch) attaches it
 * (store.attach; a taken slot is a swap). The parent tile lights --ok like a quick-move target.
 */
import type { PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import type { Cell, DropTarget, GridRef } from '../../model/types';
import { getStore } from '../hooks/useInv';
import { getCellSize } from '../hooks/useCellSize';
import { useUi } from '../uiStore';
import { useDragStore, type DragHighlight, type QuickTarget } from './dragStore';
import { zoneAt, type DropZone } from './registry';

const THRESHOLD = 4;
const SNAP_MS = 80;
const DROP_MEASURE = 'ragman:ui:drop';

export interface DragOrigin {
  id: string;
  rotated: boolean;
  /** Dragging a quick-use reference: it can only be re-bound to another box, or cleared. */
  quickUseIndex?: number;
}

interface Session {
  origin: DragOrigin;
  pointerId: number;
  srcEl: HTMLElement;
  startX: number;
  startY: number;
  /** Pointer offset inside the ghost, px. */
  grabX: number;
  grabY: number;
  rotated: boolean;
  w: number;
  h: number;
  cell: number;
  started: boolean;
  x: number;
  y: number;
  target: DropTarget | null;
  ok: boolean;
  /** Shift-drag of a stack: drop splits one unit off. */
  split: boolean;
  /** Latest modifier state from pointer/key events. */
  ctrl: boolean;
  shift: boolean;
  /** Ctrl over a container tile: the container id (target is then null). */
  quick: string | null;
  quickCache: Map<string, boolean>;
  /** Over an attachment parent's tile whose slot takes the item: where it would attach. */
  attachTo: { parent: string; slot: string } | null;
}

let s: Session | null = null;
let ghostEl: HTMLElement | null = null;
let suppressClickUntil = 0;
let finishing = false;

/** The DragLayer hands its ghost element here. */
export function setGhostElement(el: HTMLElement | null) { ghostEl = el; }

/** True right after a drag ended: the click that follows pointerup must not select or toggle. */
export function justDragged(): boolean { return performance.now() < suppressClickUntil; }

export function isDragging(): boolean { return !!s?.started; }

/** Called from a tile's pointerdown (primary button, no modifier). */
export function beginPointer(e: PointerEvent | ReactPointerEvent, srcEl: HTMLElement, origin: DragOrigin) {
  if (s || finishing) return;
  s = {
    origin, pointerId: e.pointerId, srcEl,
    startX: e.clientX, startY: e.clientY, grabX: 0, grabY: 0,
    rotated: origin.rotated, w: 1, h: 1, cell: getCellSize(),
    started: false, x: e.clientX, y: e.clientY, target: null, ok: false,
    split: false, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, quick: null, quickCache: new Map(), attachTo: null,
  };
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKeyUp, true);
}

function detach() {
  window.removeEventListener('pointermove', onMove, true);
  window.removeEventListener('pointerup', onUp, true);
  window.removeEventListener('pointercancel', onCancel, true);
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('keyup', onKeyUp, true);
}

/** A locked item crossed the drag threshold: no drag, one --bad flash, and the click that follows is swallowed. */
function refuseLocked(cur: Session) {
  detach();
  s = null;
  suppressClickUntil = performance.now() + 400;
  flash(cur.origin.id);
}

/**
 * Would quickMoveInto(id, container) find room? Read-only mirror of the engine's scan: panels in order, every
 * cell top-left first, unrotated before rotated, a plain fit (not a merge). Cached per container for the drag.
 */
function canQuickMove(cur: Session, containerId: string): boolean {
  const hit = cur.quickCache.get(containerId);
  if (hit != null) return hit;
  const store = getStore();
  const id = cur.origin.id;
  let ok = false;
  outer: for (const p of store.getItem(containerId)?.panels ?? []) {
    const grid = { kind: 'panel' as const, in: containerId, panel: p.name };
    const view = store.gridView(grid);
    for (const rotated of [false, true]) {
      const [w, h] = store.footprintOf(id, rotated);
      for (let y = 0; y + h <= view.height; y++) {
        for (let x = 0; x + w <= view.width; x++) {
          const fit = store.canFit(id, { kind: 'grid', grid, x, y, rotated });
          if (fit.reason === 'self' || fit.reason === 'cycle' || fit.reason === 'locked') break outer;
          if (fit.reason === 'not-accepted' && !(p.regions ?? []).length) continue outer;
          if (fit.ok && !fit.merge) { ok = true; break outer; }
        }
      }
    }
  }
  cur.quickCache.set(containerId, ok);
  return ok;
}

function start(cur: Session) {
  const store = getStore();
  if (cur.origin.quickUseIndex == null && store.getItem(cur.origin.id)?.locked) { refuseLocked(cur); return; }
  cur.split = cur.origin.quickUseIndex == null && cur.shift && !!store.getItem(cur.origin.id)?.consumable
    && store.quantityOf(cur.origin.id) > 1;
  const [w, h] = cur.origin.quickUseIndex != null ? [1, 1] : store.footprintOf(cur.origin.id, cur.rotated);
  const r = cur.srcEl.getBoundingClientRect();
  cur.w = w;
  cur.h = h;
  // grab offset scaled from the source box to the ghost (a slot box draws a 2x2 item at 1x1)
  const gw = w * cur.cell;
  const gh = h * cur.cell;
  cur.grabX = Math.min(gw - 1, Math.max(0, ((cur.startX - r.left) / Math.max(1, r.width)) * gw));
  cur.grabY = Math.min(gh - 1, Math.max(0, ((cur.startY - r.top) / Math.max(1, r.height)) * gh));
  cur.started = true;
  document.documentElement.classList.add('rg-dragging');
  useUi.getState().setDragging(true);
  flushSync(() => {
    useDragStore.setState({
      ghost: { id: cur.origin.id, rotated: cur.rotated, w, h, cell: cur.cell, split: cur.split },
      sourceId: cur.split ? null : cur.origin.id,
      hl: null,
      quick: null,
    });
  });
  placeGhost(cur);
}

function placeGhost(cur: Session) {
  if (ghostEl) ghostEl.style.transform = `translate3d(${cur.x - cur.grabX}px, ${cur.y - cur.grabY}px, 0)`;
}

function sameHl(a: DragHighlight | null, b: DragHighlight | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.zone !== b.zone || a.ok !== b.ok || a.cells.length !== b.cells.length) return false;
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i][0] !== b.cells[i][0] || a.cells[i][1] !== b.cells[i][1]) return false;
  }
  return true;
}

function targetFor(cur: Session, z: DropZone): DropTarget | null {
  if (cur.origin.quickUseIndex != null && z.kind !== 'quickUse') return null;
  if (z.kind === 'slot' && z.slot) return { kind: 'slot', slot: z.slot };
  if (z.kind === 'quickUse' && z.index != null) return { kind: 'quickUse', index: z.index };
  if (z.kind === 'grid' && z.grid && z.width) {
    const r = z.element.getBoundingClientRect();
    const c = (r.width - 1) / z.width || z.cellSize;
    // the ghost's top-left cell: nearest cell to the ghost's top-left corner
    const x = Math.round((cur.x - cur.grabX - r.left) / c);
    const y = Math.round((cur.y - cur.grabY - r.top) / c);
    return { kind: 'grid', grid: z.grid, x, y, rotated: cur.rotated };
  }
  return null;
}

/** Ctrl held over a container tile other than the dragged item: that container's id. */
function quickTileAt(cur: Session): string | null {
  if (!cur.ctrl || cur.origin.quickUseIndex != null) return null;
  const hit = document.elementFromPoint(cur.x, cur.y);
  const tile = hit instanceof Element ? hit.closest('[data-tile]') : null;
  const tid = tile?.getAttribute('data-tile') ?? null;
  if (!tid || tid === cur.origin.id || !getStore().isContainer(tid)) return null;
  return tid;
}

/** Over the tile of an item with an attachment slot that takes the dragged item: that parent and slot (a free slot first). */
function attachAt(cur: Session): { parent: string; slot: string } | null {
  if (cur.ctrl || cur.split || cur.origin.quickUseIndex != null) return null;
  const hit = document.elementFromPoint(cur.x, cur.y);
  const tile = hit instanceof Element ? hit.closest('[data-tile]') : null;
  const tid = tile?.getAttribute('data-tile') ?? null;
  if (!tid || tid === cur.origin.id) return null;
  const store = getStore();
  const slots = store.getItem(tid)?.attachmentSlots ?? [];
  if (!slots.length) return null;
  const fits = slots.filter((slot) => store.canAttach(cur.origin.id, tid, slot));
  const taken = new Set(store.attachmentsOf(tid).map((a) => a.slot));
  const slot = fits.find((x) => !taken.has(x)) ?? fits[0];
  return slot ? { parent: tid, slot } : null;
}

/** A drop that merges onto an identical stack lights that stack's own cells (the ghost may only overlap part of it). */
function stackCells(grid: GridRef, stackId: string, fallback: Cell[]): Cell[] {
  const it = getStore().gridView(grid).items.find((v) => v.id === stackId);
  if (!it) return fallback;
  const cells: Cell[] = [];
  for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) cells.push([x, y]);
  return cells;
}

function hitTest(cur: Session) {
  let hl: DragHighlight | null = null;
  let quick: QuickTarget | null = null;
  cur.target = null;
  cur.ok = false;
  cur.quick = quickTileAt(cur);
  cur.attachTo = cur.quick ? null : attachAt(cur);
  if (cur.attachTo) {
    cur.ok = true;
    quick = { id: cur.attachTo.parent, ok: true };
  } else if (cur.quick) {
    cur.ok = canQuickMove(cur, cur.quick);
    quick = { id: cur.quick, ok: cur.ok };
  } else {
    const z = zoneAt(cur.x, cur.y);
    if (z) {
      const t = targetFor(cur, z);
      if (t && !(cur.split && t.kind === 'quickUse')) {
        const fit = getStore().canFit(cur.origin.id, t);
        // a split dropped back on its own stack is refused (splitStack answers occupied)
        const ok = fit.ok && !(cur.split && fit.merge === cur.origin.id);
        cur.target = t;
        cur.ok = ok;
        const cells = t.kind !== 'grid' ? [] : ok && fit.merge ? stackCells(t.grid, fit.merge, fit.cells) : fit.cells;
        hl = { zone: z.key, cells, ok };
      }
    }
  }
  const prev = useDragStore.getState();
  if (!sameHl(prev.hl, hl)) useDragStore.setState({ hl });
  if (prev.quick?.id !== quick?.id || prev.quick?.ok !== quick?.ok) useDragStore.setState({ quick });
}

function onMove(e: PointerEvent) {
  const cur = s;
  if (!cur || e.pointerId !== cur.pointerId) return;
  cur.x = e.clientX;
  cur.y = e.clientY;
  cur.ctrl = e.ctrlKey || e.metaKey;
  if (!cur.started) {
    cur.shift = cur.shift || e.shiftKey;
    if (Math.hypot(cur.x - cur.startX, cur.y - cur.startY) < THRESHOLD) return;
    start(cur);
    if (!cur.started) return; // refused (locked)
  }
  e.preventDefault();
  placeGhost(cur);
  hitTest(cur);
}

function rotate(cur: Session) {
  cur.rotated = !cur.rotated;
  [cur.w, cur.h] = [cur.h, cur.w];
  [cur.grabX, cur.grabY] = [cur.grabY, cur.grabX];
  flushSync(() => {
    useDragStore.setState({ ghost: { id: cur.origin.id, rotated: cur.rotated, w: cur.w, h: cur.h, cell: cur.cell, split: cur.split } });
  });
  placeGhost(cur);
  hitTest(cur);
}

function onKeyUp(e: KeyboardEvent) {
  const cur = s;
  if (!cur?.started || (e.key !== 'Control' && e.key !== 'Meta')) return;
  cur.ctrl = false;
  hitTest(cur);
}

function onKey(e: KeyboardEvent) {
  const cur = s;
  if (!cur?.started) return;
  if (e.key === 'Control' || e.key === 'Meta') {
    if (!cur.ctrl) { cur.ctrl = true; hitTest(cur); }
    return;
  }
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    e.stopPropagation();
    if (cur.origin.quickUseIndex == null && !e.repeat) rotate(cur);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    snapBack(cur, false);
  }
}

function onCancel(e: PointerEvent) {
  const cur = s;
  if (!cur || e.pointerId !== cur.pointerId) return;
  if (cur.started) snapBack(cur, false);
  else { detach(); s = null; }
}

function clearDragState() {
  useDragStore.setState({ ghost: null, sourceId: null, hl: null, quick: null });
}

function endCommon() {
  detach();
  document.documentElement.classList.remove('rg-dragging');
  useUi.getState().setDragging(false);
  suppressClickUntil = performance.now() + 60;
  s = null;
}

function recordDrop(t0: number) {
  const ms = performance.now() - t0;
  try {
    performance.measure(DROP_MEASURE, `${DROP_MEASURE}:start`);
    performance.clearMarks(`${DROP_MEASURE}:start`);
  } catch { /* ignore */ }
  (window.__ragmanPerf ??= []).push({ name: DROP_MEASURE, ms });
}

function onUp(e: PointerEvent) {
  const cur = s;
  if (!cur || e.pointerId !== cur.pointerId) return;
  if (!cur.started) { detach(); s = null; return; }
  e.preventDefault();
  cur.x = e.clientX;
  cur.y = e.clientY;
  cur.ctrl = e.ctrlKey || e.metaKey;
  hitTest(cur);

  const store = getStore();
  const id = cur.origin.id;
  const qu = cur.origin.quickUseIndex;

  // A quick-use reference dragged off every box: unbind it.
  if (qu != null && !cur.target) {
    flushSync(() => { store.setQuickUse(qu, null); clearDragState(); });
    endCommon();
    return;
  }
  if (cur.attachTo) {
    const { parent, slot } = cur.attachTo;
    const t0 = performance.now();
    try { performance.mark(`${DROP_MEASURE}:start`); } catch { /* ignore */ }
    let ok = false;
    flushSync(() => { ok = store.attach(id, parent, slot); clearDragState(); });
    recordDrop(t0);
    endCommon();
    if (!ok) flash(id);
    return;
  }
  if (cur.quick) {
    if (!cur.ok) { snapBack(cur, true); return; }
    const into = cur.quick;
    const t0 = performance.now();
    try { performance.mark(`${DROP_MEASURE}:start`); } catch { /* ignore */ }
    let ok = false;
    flushSync(() => { ok = store.quickMoveInto(id, into).ok; clearDragState(); });
    recordDrop(t0);
    endCommon();
    if (!ok) flash(id);
    return;
  }
  if (!cur.target || !cur.ok) { snapBack(cur, true); return; }

  const t0 = performance.now();
  try { performance.mark(`${DROP_MEASURE}:start`); } catch { /* ignore */ }
  const ghostRect = ghostEl?.getBoundingClientRect() ?? null;
  const target = cur.target;
  const split = cur.split;
  let ok = false;
  let landed = id;
  flushSync(() => {
    if (split) {
      const r = store.splitStack(id, 1, target);
      ok = r.ok;
      if (r.id) landed = r.id;
    } else {
      ok = store.move(id, target).ok;
    }
    clearDragState();
  });
  recordDrop(t0);
  endCommon();
  if (!ok) { flash(id); return; }
  // FLIP: the new tile starts where the ghost was and eases into its cell in 80 ms.
  if (ghostRect && target.kind !== 'quickUse') {
    const el = document.querySelector<HTMLElement>(`[data-tile="${CSS.escape(landed)}"][data-primary]`);
    if (el && typeof el.animate === 'function') {
      const r = el.getBoundingClientRect();
      const dx = ghostRect.left - r.left;
      const dy = ghostRect.top - r.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
          { duration: SNAP_MS, easing: 'ease-out' },
        );
      }
    }
  }
}

function flash(id: string) {
  const f = useDragStore.getState().flash;
  useDragStore.setState({ flash: { id, n: (f?.n ?? 0) + 1 } });
}

function snapBack(cur: Session, withFlash: boolean) {
  detach();
  finishing = true;
  useDragStore.setState({ hl: null });
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    finishing = false;
    clearDragState();
    endCommon();
    if (withFlash) flash(cur.origin.id);
  };
  const g = ghostEl;
  if (!g || typeof g.animate !== 'function' || !cur.srcEl.isConnected) { done(); return; }
  const r = cur.srcEl.getBoundingClientRect();
  const anim = g.animate(
    [{ transform: g.style.transform }, { transform: `translate3d(${r.left}px, ${r.top}px, 0)` }],
    { duration: SNAP_MS, easing: 'ease-out', fill: 'forwards' },
  );
  anim.onfinish = done;
  anim.oncancel = done;
  window.setTimeout(done, SNAP_MS + 60); // never leave a ghost behind
}
