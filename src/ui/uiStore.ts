/**
 * Transient UI state shared across screens: which tab, which overlay is open, what is selected.
 * Not persisted. Both the Gear screen (tiles) and the App shell (overlays) import from here.
 */
import { create } from 'zustand';

export type TabId = 'overall' | 'gear' | 'skills' | 'tasks';

/** `mode` opens the menu straight into a step: the Delete key opens it on the delete confirm. */
export interface ContextMenuState { id: string; x: number; y: number; mode?: 'confirm' }
export interface TooltipState { id: string; x: number; y: number }

/** "Filter by item": the item, the ids that do the same job (sameJob), and the chip's label (its category). */
export interface JobFilter { id: string; ids: Set<string>; label: string }

export interface UiState {
  tab: TabId;
  selectedId: string | null;
  contextMenu: ContextMenuState | null;
  tooltip: TooltipState | null;
  /** Inspect windows, open order (several at once, cascaded). */
  inspectIds: string[];
  /** Stacking order of every movable window, keys `c:<id>` (container) and `i:<id>` (inspect); last = top. */
  zOrder: string[];
  editId: string | null;      // Edit form open for this item
  addOpen: boolean;           // Add item form open
  /** Set by the drag layer while a drag is in progress; overlays hide themselves. */
  dragging: boolean;
  /** Filter by item: everything else on every grid dims to 0.25 until Esc or a click on empty space. */
  jobFilter: JobFilter | null;

  setTab(tab: TabId): void;
  select(id: string | null): void;
  openMenu(id: string, x: number, y: number, mode?: ContextMenuState['mode']): void;
  closeMenu(): void;
  showTooltip(id: string, x: number, y: number): void;
  hideTooltip(): void;
  /** Open (or raise) an Inspect window. `null` is a no-op kept for old callers. */
  inspect(id: string | null): void;
  closeInspect(id: string): void;
  /** Bring a window key (`c:<id>` / `i:<id>`) to the top. */
  raise(key: string): void;
  edit(id: string | null): void;
  setAddOpen(open: boolean): void;
  setDragging(on: boolean): void;
  setJobFilter(f: JobFilter | null): void;
  /** Close every transient overlay (Esc, tab change): menu, tooltip, Edit and Add forms. Windows stay open. */
  closeAll(): void;
}

const toTop = (order: string[], key: string) => [...order.filter((k) => k !== key), key];

export const useUi = create<UiState>()((set) => ({
  tab: 'gear',
  selectedId: null,
  contextMenu: null,
  tooltip: null,
  inspectIds: [],
  zOrder: [],
  editId: null,
  addOpen: false,
  dragging: false,
  jobFilter: null,

  setTab: (tab) => set({ tab, contextMenu: null, tooltip: null }),
  select: (selectedId) => set({ selectedId }),
  openMenu: (id, x, y, mode) => set({ contextMenu: { id, x, y, mode }, tooltip: null, selectedId: id }),
  closeMenu: () => set({ contextMenu: null }),
  showTooltip: (id, x, y) => set((s) => (s.dragging || s.contextMenu ? {} : { tooltip: { id, x, y } })),
  hideTooltip: () => set({ tooltip: null }),
  inspect: (id) => set((s) => {
    if (!id) return { contextMenu: null, tooltip: null };
    return {
      inspectIds: s.inspectIds.includes(id) ? s.inspectIds : [...s.inspectIds, id],
      zOrder: toTop(s.zOrder, `i:${id}`),
      contextMenu: null,
      tooltip: null,
    };
  }),
  closeInspect: (id) => set((s) => ({
    inspectIds: s.inspectIds.filter((k) => k !== id),
    zOrder: s.zOrder.filter((k) => k !== `i:${id}`),
  })),
  raise: (key) => set((s) => (s.zOrder[s.zOrder.length - 1] === key ? {} : { zOrder: toTop(s.zOrder, key) })),
  edit: (editId) => set({ editId, contextMenu: null, tooltip: null }),
  setAddOpen: (addOpen) => set({ addOpen, contextMenu: null, tooltip: null }),
  setDragging: (dragging) => set(dragging ? { dragging, contextMenu: null, tooltip: null } : { dragging }),
  setJobFilter: (jobFilter) => set({ jobFilter }),
  closeAll: () => set({ contextMenu: null, tooltip: null, editId: null, addOpen: false }),
}));
