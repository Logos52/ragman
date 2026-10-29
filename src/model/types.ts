/**
 * Ragman data model. Mirrors schema/inventory.schema.json exactly.
 * Rules: nothing is guessed (a blank stays blank), no prices, `hidden.*` is never rendered.
 */

export type Cells = [number, number]; // [w, h]
export type Cell = [number, number];  // [x, y], 0-based from the top-left

export type Status = string;   // one of settings.statuses; '' or undefined means blank (no chip)
export type Category = string; // one of settings.categories
export type LocationName = string; // one of settings.locations

export interface Settings {
  statuses: string[];
  categories: string[];
  locations: string[];
  defaultSlots: string[];
  stashWidth: number;
}

export interface Region {
  name: string;
  at: Cell;
  size: Cells;
  accepts: string[]; // tag or category names
}

export interface Panel {
  name: string;
  grid: Cells;
  accepts?: string[] | null; // null/undefined = anything
  regions?: Region[];
}

export interface Images {
  icon?: string;  // finished grid icon, fitted to the footprint (cell art, first choice)
  grok?: string;  // Grok-generated item image (cell art, second choice)
  photo?: string; // real product photo (Inspect card; cell art, third choice)
  worn?: string;  // garment drawn on the base figure (avatar layer)
}

export interface StashPlace   { kind: 'stash'; location: LocationName; x: number; y: number; rotated: boolean }
export interface ArchivePlace { kind: 'archive'; x: number; y: number; rotated: boolean }
export interface PanelPlace   { kind: 'panel'; in: string; panel: string; x: number; y: number; rotated: boolean }
export interface SlotPlace    { kind: 'slot'; slot: string }
export type HomePlace = StashPlace | ArchivePlace | PanelPlace;
export type LoadoutPlace = SlotPlace | PanelPlace;
export type Place = HomePlace | SlotPlace;

export interface Item {
  name: string;
  nameEn?: string;
  maker?: string;
  makerUrl?: string;
  category: Category;
  status?: Status;
  location?: LocationName;
  size?: string | null;
  color?: string;
  footprint?: Cells | null; // null draws as 1x1
  weight_g?: number | null;
  weightLimit_g?: number | null; // containers only
  tags?: string[];
  staple?: boolean;
  consumable?: boolean;
  specialCare?: boolean;
  /** Sort leaves a pinned item where it is and packs the rest around it. Absent = false. */
  pinned?: boolean;
  /** A locked item cannot be moved, equipped, archived, deleted, merged or split (canFit reason 'locked'). Absent = false. */
  locked?: boolean;
  /** Ticked by the owner on the card. false or absent = unverified (drawn with a "?" mark). */
  verified?: boolean;
  /** Containers only: shown on the tile label strip instead of the name when set. */
  nickname?: string;
  /** Consumables only: how many are in this stack, an integer >= 1. Absent counts as 1 and draws nothing. */
  quantity?: number;
  note?: string;
  lesson?: string;
  images?: Images;
  /** Logged, never shown. The UI must not read this; the store round-trips it untouched. */
  hidden?: { fabric?: string; care?: string; source?: string };
  attachmentSlots?: string[];
  attachedTo?: { to: string; slot: string } | null;
  panels?: Panel[];
  panelLayout?: 'row' | 'column';
  home?: HomePlace | null; // null only for an attached item
}

/** What updateItem accepts: placement and structure (home, panels, attachedTo) change only through checked moves; hidden never. */
export type ItemPatch = Omit<Partial<Item>, 'hidden' | 'home' | 'panels' | 'attachedTo'>;

export interface Loadout {
  slots: string[];
  pocketsGrid?: Cells; // default [4, 1]
  placements: Record<string, LoadoutPlace>;
}

export interface Objective {
  text: string;
  done: boolean;
  auto?: { item: string; in: string; loadout?: string } | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'locked';
  itemId?: string | null;
  objectives: Objective[];
  /** Task ids. When this task becomes completed, each listed task that is locked becomes active. */
  unlocks?: string[];
}

export interface Skill { name: string; parent?: string | null; level: number; progress: number; note?: string }
export interface SkillGroup { name: string; skills: Skill[] }

export interface Inventory {
  version: 1;
  settings: Settings;
  items: Record<string, Item>;
  loadouts: Record<string, Loadout>;
  activeLoadout: string;
  archive: { width: number };
  quickUse: (string | null)[]; // exactly 10
  tasks: Task[];
  skills: SkillGroup[];
}

/* ---------- Derived / view-model types the engine exposes to the UI ---------- */

/** Where an item is drawn right now: the active loadout's placement, else its home. */
export type EffectivePlace = Place;

/** A grid the UI can draw. Every grid in the app (stash, archive, panel, pockets) is one of these. */
export type GridRef =
  | { kind: 'stash'; location: LocationName }
  | { kind: 'archive' }
  | { kind: 'panel'; in: string; panel: string }
  | { kind: 'pockets' }; // the active loadout's pockets panel, pocketsGrid wide

export interface GridItemView {
  id: string;
  x: number;
  y: number;
  w: number; // after rotation
  h: number; // after rotation
  rotated: boolean;
  /** Archive only: the item's location, drawn as a tag. */
  locationTag?: string;
}

export interface GridView {
  ref: GridRef;
  width: number;
  height: number; // stash/archive: grows to fit contents + padding rows; panel: fixed
  accepts: string[] | null;
  regions: Region[];
  items: GridItemView[];
}

export interface FitResult {
  ok: boolean;
  /** Cells the dragged item would cover, for the green/red highlight. */
  cells: Cell[];
  reason?: 'occupied' | 'out-of-bounds' | 'not-accepted' | 'self' | 'cycle' | 'locked';
  /** Grid drops only: the drop lands on exactly one identical stack (same product, both consumable), so move() merges into it. */
  merge?: string;
}

/** splitStack's answer: the fit of the new stack at its target, and its id when it was made. */
export interface SplitResult extends FitResult {
  id?: string;
}

/** A drop target the drag system asks the engine about. */
export type DropTarget =
  | { kind: 'grid'; grid: GridRef; x: number; y: number; rotated: boolean }
  | { kind: 'slot'; slot: string }
  | { kind: 'quickUse'; index: number };

export interface WeightSummary {
  grams: number;      // sum of known weights
  unweighed: number;  // items with weight_g null/undefined
  limit?: number | null;
  overLimit: boolean;
}

export type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export type DataSource =
  | { kind: 'server'; base: string }            // GET/PUT /data/*
  | { kind: 'folder'; handle: FileSystemDirectoryHandle } // File System Access API
  | { kind: 'bundled' };                        // public build: frozen demo JSON, edits reset on reload

export type SortMode = 'name' | 'category' | 'status' | 'size-desc';

export interface Filters {
  categories: Set<string>; // empty = all
  search: string;
  sort: SortMode;
}
