import { useEffect } from 'react';
import { TabBar } from '../primitives/TabBar';
import { Banner } from '../primitives/Banner';
import { Button } from '../primitives/Button';
import { ComingLater } from '../primitives/EmptyState';
import { GearScreen } from '../gear/GearScreen';
import { TasksScreen } from '../tasks/TasksScreen';
import { useUi } from '../uiStore';
import type { TabId } from '../uiStore';
import { getStore, isTyping, useInv, useInventory } from './useStore';
import { GearSkeleton } from './GearSkeleton';
import { Overlays } from './Overlays';
import './App.css';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overall', label: 'Overall' },
  { id: 'gear', label: 'Gear' },
  { id: 'skills', label: 'Skills' },
  { id: 'tasks', label: 'Tasks' },
];

declare global {
  interface Window { __ragmanUi?: typeof useUi; __ragmanStore?: typeof getStore }
}

/**
 * Global keys, each fires once:
 * Esc closes the menu and forms; then clears Filter by item (and the hover tooltip with it); then the tooltip alone;
 * then closes the top Inspect window.
 * Ctrl/Cmd-Z undoes (not while typing). Delete (or Backspace) on the selected item opens its menu on the
 * delete confirm, at the tile.
 */
function useGlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        const ui = useUi.getState();
        if (ui.contextMenu || ui.editId || ui.addOpen) {
          ui.closeAll();
          e.preventDefault();
        } else if (ui.jobFilter) {
          // The hover tooltip is not a step of its own: after "Filter by item" the pointer usually rests on a
          // tile, and its tooltip must not eat the Esc that ends the filter. Both go on one press.
          ui.closeAll();
          ui.setJobFilter(null);
          e.preventDefault();
        } else if (ui.tooltip) {
          ui.closeAll();
          e.preventDefault();
        } else if (ui.inspectIds.length) {
          const top = [...ui.zOrder].reverse().find((k) => k.startsWith('i:') && ui.inspectIds.includes(k.slice(2)));
          ui.closeInspect(top ? top.slice(2) : ui.inspectIds[ui.inspectIds.length - 1]);
          e.preventDefault();
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isTyping(e.target)) return;
        const ui = useUi.getState();
        const id = ui.selectedId;
        if (!id || ui.editId || ui.addOpen || ui.dragging || !getStore().getItem(id)) return;
        const el = document.querySelector<HTMLElement>(`[data-tile="${CSS.escape(id)}"][data-primary]`)
          ?? document.querySelector<HTMLElement>(`[data-tile="${CSS.escape(id)}"]`);
        const r = el?.getBoundingClientRect();
        e.preventDefault();
        ui.openMenu(id, r ? r.left + Math.min(r.width, 24) : window.innerWidth / 2, r ? r.top + Math.min(r.height, 24) : window.innerHeight / 3, 'confirm');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
        if (isTyping(e.target)) return;
        // Yield to any other handler (the Gear drag layer also binds Ctrl-Z): check after the
        // event has finished dispatching, and undo only if nobody else handled it.
        window.setTimeout(() => { if (!e.defaultPrevented) getStore().undo(); }, 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * Filter by item ends on a click on empty space: anything that is not a tile, a menu, a control or a window bar.
 * The click that chose the menu row is older than the filter, so it is ignored.
 */
function useJobFilterDismiss() {
  const on = useUi((s) => !!s.jobFilter);
  useEffect(() => {
    if (!on) return;
    const since = performance.now();
    const onClick = (e: MouseEvent) => {
      if (e.timeStamp < since) return;
      const t = e.target as Element | null;
      if (t?.closest?.('[data-tile], .rg-cmenu-root, button, a, input, select, textarea, label, .rg-window__bar')) return;
      useUi.getState().setJobFilter(null);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [on]);
}

let booted = false;

export function App() {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const inv = useInv();
  const loadError = useInventory((s) => s.loadError);

  useEffect(() => { if (!booted) { booted = true; void getStore().boot(); } }, []);
  useEffect(() => {
    if (import.meta.env.DEV) { window.__ragmanUi = useUi; window.__ragmanStore = getStore; }
  }, []);
  useGlobalKeys();
  useJobFilterDismiss();

  let screen;
  switch (tab) {
    case 'gear': screen = inv ? <GearScreen /> : <GearSkeleton />; break;
    case 'tasks': screen = <TasksScreen />; break;
    case 'overall': screen = <div className="rg-app__panel"><ComingLater name="Overall" /></div>; break;
    case 'skills': screen = <div className="rg-app__panel"><ComingLater name="Skills" /></div>; break;
  }

  return (
    <div className="rg-app">
      <TabBar tabs={TABS} active={tab} onChange={(id) => { useUi.getState().closeAll(); setTab(id as TabId); }} />
      {loadError ? (
        <Banner
          tone="bad"
          action={<Button size="sm" variant="ink" onClick={() => void getStore().openFolder()}>Choose folder</Button>}
        >
          Inventory file not found ·
        </Banner>
      ) : null}
      <main className="rg-app__main" data-tab={tab}>{screen}</main>
      <Overlays />
    </div>
  );
}
