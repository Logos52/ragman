/**
 * One movable Window per open container (store.openWindows). Every panel of the container is a grid drop zone;
 * empty panels other than the first collapse behind a "+" chip. The panel rendering (`ContainerPanels`) is shared
 * with the Inspect window of a container, so items drag in and out from either.
 * Positions: remembered per item id in this browser (hooks/windowMemory), else cascaded from the middle column;
 * always kept inside the viewport with a 16 px gutter on every side (under the tab bar). Stacking is shared with the Inspect windows through uiStore.zOrder.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Window } from '../primitives/Window';
import { WeightReadout } from '../primitives/WeightReadout';
import { LabelTab } from '../primitives/LabelTab';
import { Glyph } from '../primitives/glyphs';
import { getStore, useInventory } from '../hooks/useInv';
import { recallPos, rememberPos, TAB_BAR, type WinPos } from '../hooks/windowMemory';
import { useUi } from '../uiStore';
import { GridZone, useGridRef } from './GridZone';
import './gear.css';

type Pos = WinPos;

/** Every window keeps this gap from the viewport's left, right and bottom edges and from the tab bar. */
export const GUTTER = 16;

/**
 * Keep a window's box inside the viewport with a GUTTER on every side, never above the tab bar. A window wider or
 * taller than the room left sits at the left / top gutter (CSS caps its size to the same room, so that is rare).
 */
export function clampWin(p: Pos, el: HTMLElement | null): Pos {
  const r = el?.getBoundingClientRect();
  const w = r ? Math.ceil(r.width) : 200;
  const h = r ? Math.ceil(r.height) : 28;
  const top = TAB_BAR + GUTTER;
  const maxX = Math.max(GUTTER, window.innerWidth - w - GUTTER);
  const maxY = Math.max(top, window.innerHeight - h - GUTTER);
  return { x: Math.round(Math.min(Math.max(GUTTER, p.x), maxX)), y: Math.round(Math.min(Math.max(top, p.y), maxY)) };
}

/**
 * Where a window first opens. Desktop: the cascade (or the remembered spot). Phone (under 640 px): the cascade
 * would push the window against the right edge, so it opens centered across the viewport (a 16 px gutter each side
 * whenever it is narrower than the viewport less 32 px); dragging it afterwards still uses clampWin.
 */
export function firstPos(p: Pos, el: HTMLElement | null): Pos {
  const vw = window.innerWidth;
  if (vw >= 640 || !el) return p;
  // measure the natural width: at the cascade x the absolutely placed window is squeezed by the right edge
  const left = el.style.left;
  el.style.left = '0px';
  const w = el.offsetWidth;
  el.style.left = left;
  return { x: Math.round((vw - w) / 2), y: p.y };
}

/** `spare`: the whole container is empty (every panel), so its main panel reads "Spare". */
function PanelGrid({ id, panel, spare, scope }: { id: string; panel: string; spare: boolean; scope: string }) {
  const grid = useGridRef({ kind: 'panel', in: id, panel });
  return (
    <div className="gear-win__panel">
      <LabelTab>{panel}</LabelTab>
      <GridZone
        grid={grid}
        scope={scope}
        behind={spare ? <span className="gear-win__spare">Spare</span> : null}
      />
    </div>
  );
}

/**
 * Every panel of a container as live grids, in a row (bags) or a column (drawer units). `scope` keeps zone keys apart.
 * Empty panels other than the first collapse behind "+" chips, gathered in one wrapping group after the shown panels,
 * so a bag with many pockets never widens its window past the viewport (the group is capped at 6 cells wide).
 */
export function ContainerPanels({ id, scope }: { id: string; scope: string }) {
  const item = useInventory((s) => s.inv?.items[id]);
  const panels = item?.panels ?? [];
  // one character per panel ('1' = empty): a string keeps the selector stable for zustand
  const empties = useInventory((s) => (s.inv?.items[id]?.panels ?? [])
    .map((p) => (s.gridView({ kind: 'panel', in: id, panel: p.name }).items.length === 0 ? '1' : '0')).join(''));
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const collapsed = (i: number, name: string) => i > 0 && empties[i] === '1' && !opened.has(name);
  const chips = panels.filter((p, i) => collapsed(i, p.name));
  return (
    <div className={item?.panelLayout === 'column' ? 'gear-win__panels gear-win__panels--column' : 'gear-win__panels'}>
      {panels.map((p, i) => (collapsed(i, p.name) ? null
        : <PanelGrid key={p.name} id={id} panel={p.name} spare={i === 0 && !empties.includes('0')} scope={scope} />))}
      {chips.length ? (
        <div className="gear-win__chips">
          {chips.map((p) => (
            <button
              key={p.name}
              type="button"
              className="gear-win__more"
              onClick={() => setOpened((o) => new Set(o).add(p.name))}
              title={`Show ${p.name}`}
            >
              <Glyph name="plus" size={12} strokeWidth={2} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The window title for a container: its nickname first when it has one. */
export function containerTitle(item: { name: string; nickname?: string }): string {
  const nick = (item.nickname ?? '').trim();
  return nick ? `${nick} · ${item.name}` : item.name;
}

/** Position state for a movable window: remembered spot or `start`, clamped on open and on resize, saved on drop. */
export function useWindowPos(kind: 'container' | 'inspect', id: string, start: Pos) {
  const [pos, setPos] = useState<Pos>(() => recallPos(kind, id) ?? start);
  const remembered = useRef(recallPos(kind, id) != null);
  const box = useRef<HTMLDivElement>(null);
  const el = () => box.current?.querySelector<HTMLElement>('.rg-window') ?? null;
  const posRef = useRef(pos);
  posRef.current = pos;

  useLayoutEffect(() => {
    setPos((p) => clampWin(remembered.current ? p : firstPos(p, el()), el()));
  }, []);
  useEffect(() => {
    const onResize = () => setPos((p) => clampWin(p, el()));
    window.addEventListener('resize', onResize);
    // the window's own size changes after it opens (fonts, grids measuring their cells, a chip expanding a panel):
    // re-clamp then too, so a window that grew never ends up against or past the viewport edge
    const node = el();
    const ro = node && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (node) ro?.observe(node);
    return () => { window.removeEventListener('resize', onResize); ro?.disconnect(); };
  }, []);
  const onMove = useCallback((x: number, y: number) => setPos(clampWin({ x, y }, el())), []);
  const onMoveEnd = useCallback(() => rememberPos(kind, id, posRef.current), [kind, id]);
  return { pos, box, onMove, onMoveEnd };
}

/** z index for a window key from the shared stacking order. */
export function useWindowZ(key: string, fallback: number): number {
  return useUi((s) => {
    const i = s.zOrder.indexOf(key);
    return 100 + (i >= 0 ? i : fallback);
  });
}

const ContainerWindow = memo(function ContainerWindow({ id, start, fallbackZ }: { id: string; start: Pos; fallbackZ: number }) {
  const item = useInventory((s) => s.inv?.items[id]);
  const weight = useInventory((s) => s.weightOf(id));
  const { pos, box, onMove, onMoveEnd } = useWindowPos('container', id, start);
  const z = useWindowZ(`c:${id}`, fallbackZ);

  // Read live store state at event time: this component is memoised, so state captured during
  // render goes stale as soon as another window opens.
  const onRaise = useCallback(() => {
    const s = getStore();
    if (s.openWindows[s.openWindows.length - 1] !== id) s.raiseWindow(id);
    useUi.getState().raise(`c:${id}`);
  }, [id]);
  const onClose = useCallback(() => getStore().closeWindow(id), [id]);
  if (!item) return null;
  return (
    <div ref={box} className="gear-win-host">
      <Window
        title={containerTitle(item)}
        x={pos.x}
        y={pos.y}
        z={z}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        onRaise={onRaise}
        onClose={onClose}
        right={<WeightReadout grams={weight.grams} unweighed={weight.unweighed} estimated={weight.estimated} limit={weight.limit} overLimit={weight.overLimit} tone="light" />}
        className="gear-win"
      >
        <ContainerPanels id={id} scope="win" />
      </Window>
    </div>
  );
});

/** The open container windows. Rendered inside the shared window layer (app/Overlays), on the Gear tab only. */
export function ContainerWindows() {
  const open = useInventory((s) => s.openWindows);
  // a window opened (or re-opened, which raises it in the store) comes to the top of the shared order
  const top = open[open.length - 1];
  useEffect(() => { if (top) useUi.getState().raise(`c:${top}`); }, [top, open.length]);
  // first position of each window, fixed when it opens (cascade 80 + 24 * i from the middle column)
  const starts = useRef(new Map<string, Pos>());
  for (const k of [...starts.current.keys()]) if (!open.includes(k)) starts.current.delete(k);
  open.forEach((id, i) => {
    if (starts.current.has(id)) return;
    const r = document.querySelector('.gear__middle')?.getBoundingClientRect();
    const n = starts.current.size || i;
    starts.current.set(id, { x: (r?.left ?? 0) + 80 + 24 * n, y: (r?.top ?? 0) + 80 + 24 * n });
  });
  if (!open.length) return null;
  // DOM order stays the order windows were opened (Map insertion order); stacking comes from z only.
  // Re-ordering the DOM on raise would move the node under the pointer and drop the title bar's
  // pointer capture mid-drag.
  const mounted = [...starts.current.keys()];
  return (
    <>
      {mounted.map((id) => <ContainerWindow key={id} id={id} start={starts.current.get(id)!} fallbackZ={open.indexOf(id)} />)}
    </>
  );
}
