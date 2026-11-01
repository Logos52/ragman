# Ragman Table view PRD

2026-10-31 · draft, not built · from Wedge's brief of 2026-10-31

## Purpose

The Table view shows every item as a spreadsheet row Wedge can sort, filter and edit in bulk. He moves items by dragging rows onto container rows. His brief: "i want a view that's mostly spreadsheet based, and i can move items into different containers (tables)  2/3 on the right will be the primary table just like the (stash)  and 1/3 is dedicated to a table of the containers.  and i can drag+drop items into different containers.    basically similar to ragman but table view instead of what we have like a video game inventory".

It uses the same store as Gear. A move here is the move Gear would make, Gear's grid positions survive, and the schema does not change.

## Layout

A new top tab, `TABLE`, sits between Gear and Skills. The Quick Use row is hidden on it; the footer stays. The left third (min 400 px) is the containers table. The right two-thirds is the primary table, the rows of one container.

The primary panel has a title row (scope name such as `STASH · USA`, weight, row count, `DEEP`, `COLUMNS`, `+ ADD`), a filter bar that a bulk bar replaces while rows are selected, and the sheet, with a sticky header and frozen `#` and Name columns.

Below 1100 px the split is 40/60. Existing tokens cover both themes; one new token, `--sel`, fills selected rows. `shots.mjs` adds Table at desktop and 390 px.

## Containers table

The header holds the same loadout switch as Gear (`switchLoadout`). Rows come from a new read, `containerTree()`, and each container appears once, at its effective place in the active loadout:

1. `ALL ITEMS · N`.
2. `PERSON · <loadout>`: `POCKETS`, each filled slot (`EYES · JINS 221`), each carry slot with its bag (`BACKPACK · FILSON JOURNEYMAN`, or `BACKPACK · EMPTY`, which still takes drops). Containers inside a bag are listed under it.
3. Each stash tab in tab order (`STASH · USA`), with its containers nested.
4. `ARCHIVE`, with its containers nested.

A container with two or more panels has one child row per panel. Reserved regions get no rows.

Columns: Name (indented by depth, nickname first), Items (`SPARE` when empty), Fill (occupied over grid cells, `31/48`, a stash tab out of 680), and Weight (`--bad` past a limit).

Clicking a row makes it the primary table's scope. Double-clicking a container opens its window. Right-clicking a stash tab offers `Rename`, `Delete` and `New stash tab`. A container row can be dragged, and its contents go with it. During a drag, the hovered row fills `--ok` or `--bad` and its Fill cell reads `FITS 3`, `NO ROOM`, `NOT ACCEPTED`, `LOCKED`, `INSIDE ITSELF` or `NO SLOT`.

## Primary table

The scope starts as the stash tab Gear last showed, then is the containers row clicked last. `DEEP` off shows direct contents; on, it shows every depth with a path in the In column. In a container, rows group under panel bands showing label, grid, fill, accepts and region names. Attached items sit indented under their parent.

Default order is grid reading order. Header clicks sort ascending, descending, then back to grid order; Shift-click adds a key. Sorting never calls `sortGrid`.

| Column | Behavior |
|---|---|
| # | Row number, selection and drag handle |
| Art | 28 px cell art, read-only |
| Name, Size, Fp, Weight | Text; Fp is `w×h`; Weight is grams, `~` when estimated |
| Category, Status, Location | Selects from `settings` |
| Flags | Pin, lock, `?`; a click toggles |
| In | Panel, slot or path, read-only; shown when the scope spans more than one grid |

Optional columns: Qty, Tags, Maker, Color, Note, Lesson. Fabric, care, source and price are never columns, and `hidden` is never read. Each header has an autofilter: a value checklist with `(Blank)`, or a min–max range for Weight and Fp. A blank value renders blank.

## Moving items

A drag starts from `#` or Art. Dragging a selected row carries the selection. A locked row never starts a drag. Every drop calls the new `quickMoveMany(ids, target)` once.

| Drop on | Rule |
|---|---|
| A container row | `quickMoveInto`: first free cells of the first accepting panel |
| A panel, stash tab, ARCHIVE or POCKETS row | First free cells of that grid, then `move()`, which sets the location, sets Not Worn, or writes a loadout placement |
| PERSON | `equip` with no slot |
| A slot row | That slot, one item only |

If any item would be refused, a locked one included, nothing moves, as with Sort. On refusal the rows snap back, flash `--bad` and stay selected, and a strip shows for 4 s: `NOT MOVED · MacBook Pro 14: not accepted · 2 others: no room`. On success, one undo step covers the drop and every unmoved item keeps its cells. Exact cell placement stays in Gear, reached by `Show in Gear` in the row menu.

`M` or `MOVE TO…` opens a list of containers rows with each outcome; refused entries cannot be picked.

## Editing in place

Double-click, Enter or typing opens a cell; Esc cancels. A `~` before a weight sets `weightEstimated`. One cell is one `updateItem` call and one undo step, so its rules apply at once: Not Worn archives the item, a status away from Not Worn returns it to its stash, a Location change moves a stash-homed item to that stash's first free cells, and an Fp change re-fits it. An edit that would move a locked item is refused.

Bulk edits are one undo step each. A commit with several rows selected writes all of them. Cmd/Ctrl-D fills down. Cmd/Ctrl-V pastes TSV over existing rows and never creates rows. The bulk bar calls `updateItems` and `setFlagMany`. Valid cells apply; refused cells flash `--bad` and keep their value.

Values must match `settings`, Fp is 1 to 40, Weight is 0 or more, and Name cannot be blank. Delete blanks cells; items are deleted only from the context menu, one at a time. Cmd/Ctrl-C copies rows as TSV.

## Selection and keys

Click selects a row, Shift-click a range, Cmd/Ctrl-click toggles a row. Rows hidden by a filter or moved out of the scope leave the selection. Right-click opens the Gear menu plus `Show in Gear`.

| Key | Action |
|---|---|
| Arrows, Shift + arrows | Move, extend the selection |
| M, E, A, I | Move to…, equip, archive, Inspect |
| Cmd/Ctrl-Z | Undo, ten steps, shared with Gear |
| / | Search |

## Phone

At 390 px nothing scrolls sideways. A scope bar (`IN: STASH · USA ▾`) opens the containers tree full width. Rows are 48 px: `#`, art and name with status, category and In below, and Weight. Tapping Weight edits it with the number keypad. Tapping `#` selects and docks the bulk bar; `MOVE TO` opens the tree with each outcome. There is no drag on phone.

## Data and engine

New operations:

| Operation | Does | Refuses |
|---|---|---|
| `quickMoveMany(ids, target)` | Target is a container, grid, the person or a slot. On a clone of `inv`, places each item by the existing rule; commits only if all succeed; one undo step; items already in the target keep their cells | `locked`, `self`, `cycle`, `not-accepted`, `occupied`, `no-slot`, a slot target with several ids |
| `updateItems(edits)` | `updateItem` per edit, one undo step; returns applied and refused | per cell, by `updateItem`'s rules |

Also new: `canQuickMoveMany` (the same as a dry run, for hover), `setFlagMany(ids, flag, on)` (one undo step), `containerTree()` and `rowsIn(scope, deep)` (ids in grid reading order).

No new `FitResult` reason. Table state lives in `uiStore` and is not saved. The body virtualises above 300 rows.

## Release plan

**v1:** the tab, both tables, drag and `MOVE TO…`, single and bulk edits, phone layout, the new operations.

**Later, if Wedge asks:** saved views, a Duplicates view, a weigh session, CSV export.

## Decisions taken

- Tab name: chosen `TABLE`; alternatives: `MANIFEST`; why: his word.
- Partial moves: chosen all or nothing; alternatives: move what fits, or skip locked rows; why: matches Sort.
- Tree order: chosen person before stash tabs; alternatives: stash tabs first; why: packing moves go toward the person.
- Loadout control: chosen a switch; alternatives: a read-only chip; why: person rows depend on the loadout.
- Quick Use row: chosen hidden; alternatives: kept as a drop target; why: it is a Gear task.
- Row art: chosen a 28 px cell and a Flags column; alternatives: game tiles; why: he asked for a table.
- Default order: chosen grid order; alternatives: unsorted; why: the table matches the grid.
- Container scope: chosen panel bands; alternatives: a flat list; why: accepts stay visible.
- Filtering: chosen header autofilter; alternatives: chips and strips, or a filter row; why: one control covers every column.
- Ctrl/Cmd-click: chosen toggle selection; alternatives: `sendToStash`; why: he asked for multi-select.
- Spreadsheet extras: chosen fill-down and TSV; alternatives: cell bar, fill handle, range drag; why: cheaper to build.
- Bulk refusals: chosen apply valid cells; alternatives: refuse the batch; why: cells are independent.
- Status bulk change: chosen `updateItems`; alternatives: `setStatusMany`; why: `updateItem` already archives.
- Fit reasons: chosen none new; alternatives: `stash-only`; why: `not-accepted` already covers it.
- Regions: chosen bands only; alternatives: region drop rows; why: panel drops respect regions.
- Drop targets: chosen containers, grids, person, slots; alternatives: also Quick Use, attach, merge; why: those are Gear actions.
- Stash tabs: chosen right-click on stash rows; alternatives: Gear only, or `+ TAB`; why: the operations exist.
- Bulk delete: chosen none; alternatives: `deleteMany`; why: Delete blanks cells in a sheet.
- Flag toggles: chosen `setFlagMany`; alternatives: per-item setters; why: undo holds ten steps.
- Phone rows: chosen two-line rows; alternatives: a sideways table; why: weighing is the main phone edit.
- Stash fill: chosen cells over 680; alternatives: rows in use; why: the stash is 10 x 68.
- Windowing: chosen above 300 rows; alternatives: 200 or 1000; why: 73 items today.

## Open questions

- [ ] Partial drops: (a) nothing moves; (b) what fits moves. Pick: (a).
- [ ] Tab name: (a) `TABLE`; (b) `MANIFEST`. Pick: (a).
- [ ] Remember columns, sort and filters: (a) no, reset on reload; (b) in `inventory.json`; (c) per browser, which changes the architecture rule. Pick: (a) for v1.
- [ ] Saved views, Duplicates, weigh session, CSV export: (a) later; (b) v1. Pick: (a).
- [ ] Location cell: (a) editable, moving items to the new stash's first free cells; (b) read-only. Pick: (a).
- [ ] Vendors: there are two, Minimalist (items from minimalism creators) and BIFL. Grok Bot compiles their items into `vendors/minimalist.json` and `vendors/bifl.json` in the data repo. They are items Wedge is considering, not items he owns. (a) A `VENDORS` group in the containers table, where dragging a row onto a stash tab means he bought it; (b) a separate tab. Pick: (a).
