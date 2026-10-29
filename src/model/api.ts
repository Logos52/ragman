/**
 * The engine/store contract. UI code imports ONLY from here and from types.ts.
 * Implemented in src/model/store.ts (zustand). Every call is synchronous and in-memory;
 * persistence happens in the background and never blocks an interaction.
 */
import type {
  Cell, Cells, DataSource, DropTarget, EffectivePlace, Filters, FitResult, GridRef, GridView, Inventory, Item, ItemPatch,
  Loadout, Panel, SaveState, SortMode, SplitResult, Task, WeightSummary, LoadoutPlace,
} from './types';

export interface InventoryState {
  /** null until a data source has loaded. */
  inv: Inventory | null;
  source: DataSource | null;
  loadError: string | null;   // set when no source can be opened or the file is unreadable
  saveState: SaveState;
  saveError: string | null;
  /** The stash/archive view's current filters (UI state, not persisted). */
  filters: Filters;
  /** Which stash location the right column shows, and whether Archive is shown instead. */
  stashLocation: string;
  showArchive: boolean;
  /** Ids of containers whose windows are open, in z order (last = top). */
  openWindows: string[];
  /** Undo depth available (max 10). */
  undoDepth: number;
}

export interface InventoryActions {
  /* ---- loading / saving ---- */
  /** Try /data/inventory.json (server), else bundled demo in the public build, else wait for openFolder. */
  boot(): Promise<void>;
  /** File System Access API: user picks the ragman-data clone. */
  openFolder(): Promise<void>;
  /** Force a save now (used by the "retry" on the not-saved badge). */
  saveNow(): Promise<void>;
  /** Save a pasted image; returns the path relative to images/ (e.g. "photos/<slug>.png"). */
  saveImage(relPath: string, blob: Blob): Promise<string>;

  /* ---- reading (pure, cheap; safe to call in render) ---- */
  getItem(id: string): Item | undefined;
  /** Active loadout's placement, else home. Attached items resolve to their parent's place. */
  effectivePlace(id: string): EffectivePlace | null;
  /** Footprint after rotation, blank footprint = [1,1]. */
  footprintOf(id: string, rotated?: boolean): Cells;
  isContainer(id: string): boolean;
  /** Children in a container's panels (recursive when deep). */
  contentsOf(containerId: string, deep?: boolean): string[];
  attachmentsOf(id: string): { slot: string; item: string }[];
  gridView(ref: GridRef): GridView;
  /** Item in a slot of the active loadout, if any. */
  slotItem(slot: string): string | null;
  /** The carry slots that render in the middle column: Pockets, Backpack, Carry-on, Pouch (those present in the loadout). */
  carrySlots(): string[];
  weightOf(containerId: string): WeightSummary;
  /** Everything on the person in the active loadout, recursive, attachments included. No limit. */
  carriedWeight(): WeightSummary;
  /** Resolve cell art: icon → grok → photo → null (placeholder). Returns a URL usable in <img src>. */
  imageUrl(id: string, kind: 'cell' | 'photo' | 'worn'): string | null;
  /** The URL of the avatar base figure, or null if images/avatar/base.png does not exist. */
  avatarBaseUrl(): string | null;
  /** Locked items answer reason 'locked'. A grid drop onto exactly one identical stack answers ok with `merge` (move() merges). */
  canFit(id: string, target: DropTarget): FitResult;
  /** "Filter by item": other items with the same category (and the same tag set when the item has tags). Excludes `id`. */
  sameJob(id: string): string[];
  /** Stack size: quantity, absent = 1. */
  quantityOf(id: string): number;
  /** Would dropping stack `source` on stack `target` merge them (same product, both consumable, neither locked)? */
  canMerge(source: string, target: string): boolean;
  /** Stash/Archive items after filters (category/search), in sort order. Used by the filter strip. */
  filteredIds(ref: GridRef): string[];
  activeLoadout(): Loadout;
  /** Progress of auto objectives is derived; this returns tasks with `done` resolved. */
  tasksView(): Task[];
  /** Can `id` go on `parent`'s attachment `slot`? The slot takes items whose tags or category include its name; a taken slot is a swap. */
  canAttach(id: string, parent: string, slot: string): boolean;
  /** Every {parent, slot} the item can be attached to (for the menu's Attach to row), in item order. */
  attachTargets(id: string): { parent: string; slot: string }[];

  /* ---- mutations (each is one undo step unless noted) ---- */
  move(id: string, target: DropTarget): FitResult;         // the drag/drop; snaps back when !ok; merges onto an identical stack
  /** Quick move: first free cells of the container's first panel (in order) that accepts the item; snaps back when !ok. */
  quickMoveInto(id: string, containerId: string): FitResult;
  equip(id: string, slot?: string): boolean;               // Alt-click / menu; picks the first fitting empty slot when slot omitted
  sendToStash(id: string): void;                           // Ctrl-click / menu; auto-place first free cells of the item's location
  archive(id: string): void;                               // sets status Not Worn, moves to archive first free cells
  unarchive(id: string, target?: DropTarget): void;        // clears status, returns to its location's stash (or target)
  setQuickUse(index: number, id: string | null): void;
  setPinned(id: string, on: boolean): void;                // Sort leaves pinned items in place
  setLocked(id: string, on: boolean): void;                // locked: no move, equip, archive, delete, merge, split
  setVerified(id: string, on: boolean): void;              // the card's tick; false removes the key
  setNickname(id: string, nickname: string | null): void;  // containers only; blank removes it
  /** Merge stack `source` into stack `target`; source is deleted. False when they cannot merge. */
  mergeStacks(source: string, target: string): boolean;
  /** Split n off a stack into a new item `<id>-<k>` at `target` (default: first free cells of the stack's grid). */
  splitStack(id: string, n: number, target?: DropTarget): SplitResult;
  sortGrid(ref: GridRef, mode?: SortMode): void;           // Sort button: first-free repack in `mode` order (default filters.sort)
  switchLoadout(name: string): void;                       // unused items go back to stash, first free cells
  setStashLocation(loc: string): void;                     // UI state, not undoable
  setShowArchive(on: boolean): void;                       // UI state
  setFilters(patch: Partial<Filters>): void;               // UI state
  openWindow(id: string): void;
  closeWindow(id: string): void;
  raiseWindow(id: string): void;
  updateItem(id: string, patch: ItemPatch): void;          // Edit form; hidden, home, panels, attachedTo are stripped (panels: setPanels, attachedTo: attach/detach); bad nickname/quantity refused
  addItem(id: string, item: Item): void;                   // lands 1x1 in the current stash, first free cells
  deleteItem(id: string): void;                            // contents go to stash; attachments are detached and go to their stash; refused when locked
  setObjectiveDone(taskId: string, index: number, done: boolean): void;
  setTaskStatus(taskId: string, status: Task['status']): void; // to completed: every locked task in `unlocks` becomes active
  addTask(task: Task): void;
  updateTask(id: string, patch: Partial<Task>): void;
  deleteTask(id: string): void;
  setLoadoutPlacement(id: string, place: LoadoutPlace | null): void; // low level; move() uses it
  /**
   * Replace a container's panels (grid, accepts, regions; an item with none gains them). `from[i]` is the old name of
   * panels[i] (null = new) so a rename keeps its contents; contents that no longer fit are re-placed like a footprint
   * edit. Refused (false) for an empty list, blank/duplicate names, bad cells, a region outside its panel, or when a
   * locked item would have to move.
   */
  setPanels(id: string, panels: Panel[], from?: (string | null)[]): boolean;
  /** The active loadout's slot list (add or remove slots). Items in a removed slot go home. Refused if a locked item would move. */
  setLoadoutSlots(slots: string[]): boolean;
  /** The active loadout's pockets grid [w, h], 1 to 40 each. Pockets items that no longer fit are re-placed, else go home. */
  setPocketsGrid(grid: Cells): boolean;
  /** Attach an item to a parent's attachment slot (swaps out an item already there, which goes to its stash). */
  attach(id: string, parent: string, slot: string): boolean;
  /** Take an attachment off; it lands at the first free cells of its stash (the Archive when Not Worn). */
  detach(id: string): boolean;
  undo(): void;                                            // up to 10 steps
  /** Export helpers. JSON export never includes hidden.* (strip) and never prices (there are none). */
  exportJson(): string;
  exportTaskChecklist(taskId: string): string;
}

export type InventoryStore = InventoryState & InventoryActions;

/** First free top-left cell in a grid for a w x h footprint, scanning rows then columns; null when none. */
export type FirstFreeFn = (view: GridView, size: Cells) => Cell | null;
