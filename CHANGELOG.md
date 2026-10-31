# Patch notes

Newest first. The public demo at logos52.github.io/ragman shows these under Patch notes in the top bar.

## 2026-10-31

- Data sync: after a save, the data repo is committed and pushed in the background, so the layout follows you between machines. The footer shows `SYNCED hh:mm`, `PUSHING`, `PUSH FAILED · RETRY`, or `CONFLICT · PULL BY HAND` with Retry. Off when the data folder is not a git repo with a remote, or with `RAGMAN_SYNC=0`.
- Item batches: `scripts/check-items.py` validates a vendor stock or inbox batch of item records against the schema, the value lists and the no-prices rule before it is merged.
- Fixed stash size, like EFT: every stash has a fixed number of rows, 68 unless you change it. When a stash is full, Add, Move to Stash, Unarchive and a loadout switch that would send an item home are refused instead of growing the grid. The Archive still grows.
- Stash tabs: add a tab with the `+` at the end of the row; the pencil after Archive renames the open tab, moves it left or right, deletes it (only when no item has that location) and sets the number of stash rows.
- Dark mode: a moon button in the tab bar turns it on, a sun button turns it off. Each browser remembers the choice. Item tiles stay light so product photos keep their white backgrounds.
- Light theme: grey labels, red error text and blue region labels are darker, and orange buttons and chips use dark text, so every label reads at the same contrast in both themes.

## 2026-10-30

- Overall tab: item count, counts per status and location, items and carried weight per loadout, how full each stash is, empty containers, and an Export JSON button that leaves the hidden fields out.
- Avatar pipeline: `scripts/worn-fit.py` cuts Grok's base figure and isolates each worn garment against it for the paper doll.
- Six weights now come from the maker's published specs instead of estimates; the source is logged on each item.
- Public demo: the app now publishes itself to logos52.github.io/ragman on every push, with a demo inventory shaped like the real one (same counts, footprints, loadouts and tasks) but with made-up names, generic colours and no photos.
- Patch notes: this list, opened from the top bar.
- Verify all: one button in the stash header ticks every item in one undo step. Once nothing is left it reads Unverify all.
- Estimated weights: a weight can be marked as a guesstimate. Bag headers, the footer and the card then show a ~ and a count of estimates.

## 2026-10-29

- Clothing tiles show the product photo instead of a rendered icon.
- Furniture never nests: a chair or a drawer unit is refused by every container and lives only in a stash.
- Polish pass: drag ghost and target tints, pin and lock chips, small-tile name rule, 16 px window gutters, phone tab bar, tooltip placement, loading skeletons, empty states.
- Retained stash grids: switching location or opening the Archive takes one frame instead of rebuilding the grid.

## 2026-10-28

- First build of the Inventory app: the placement engine, Gear and Tasks screens, right-click menus, Inspect windows, drag and drop with rotation, containers inside containers, loadouts, sort, undo, stacks, pin and lock, Quick Use, tasks with auto objectives.
