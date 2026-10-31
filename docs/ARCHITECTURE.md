# Architecture

Vite + React 18 + TypeScript + zustand. No router, no CSS framework, no UI library. Everything is in memory; the file saves in the background.

## Folders

| Path | Holds |
| --- | --- |
| `src/model/types.ts` | the data model, mirrors `schema/inventory.schema.json` |
| `src/model/api.ts` | the store contract the UI codes against |
| `src/model/store.ts` | zustand store implementing `InventoryStore` |
| `src/model/engine/*.ts` | pure functions: placement, fit, occupancy, weights, loadout switch, sort, stacks, undo, structure edits (`structure.ts`: panels, loadout slots and pockets, attach/detach, stash tabs and stash rows), the Overall summary (`overall.ts`) |
| `src/model/persist.ts` | data sources: server (`/data/*`), folder (File System Access API), bundled (public demo) |
| `src/ui/*` | React components; one folder per screen region |
| `src/styles/*` | design tokens and global CSS; see `docs/DESIGN.md` |
| `scripts/serve.mjs` | standalone tiny server for a production build pointed at a ragman-data clone |
| `scripts/sync.mjs` | background git sync of the data repo, used by both servers |
| `scripts/shots.mjs` | Playwright screenshots of every view in every state, desktop and phone |

## Rules the code enforces

- The UI never reads `item.hidden`. A test greps `src/ui` for `hidden.` and fails on a hit.
- Nothing reads a `.prices.txt`; the data server refuses any path containing `prices`.
- A blank value renders blank: no "unknown", no "n/a", no inferred default. A blank footprint draws 1x1; a blank status draws no chip.
- A missing image draws a grey placeholder tile with the item name. Never another item's image.
- Cell art priority: `images.icon`, then `images.grok`, then `images.photo`, then placeholder.
- Every mutation is synchronous; `persist` debounces the write (500 ms) and shows `saveState` in the footer badge.
- Undo stack: ten snapshots of `inv` (73 items is about 60 KB, so snapshots are cheap).
- Window positions (container and Inspect windows) are the only thing the UI keeps in `localStorage` (`ragman:win:<kind>:<id>`), every read and write in try/catch; nothing else is stored in the browser.
- UI state that is not data (`src/ui/uiStore.ts`): open Inspect windows (`inspectIds`), the shared window stacking order (`zOrder`), the Filter by item highlight (`jobFilter`).
- Drag is pointer-event based (no HTML5 DnD). The ghost follows the cursor via `transform`, the hovered grid cell is computed from geometry, and `canFit` runs on every pointermove (O(cells), under 1 ms).
- Performance: `performance.mark` around every store mutation and the drag frame; `window.__ragmanPerf` exposes the measurements so the screenshot script can assert under 100 ms.
- A stash is a fixed grid, `settings.stashWidth` x `settings.stashRows` (default 68, set by `normalize` when absent); only the Archive grows (`isGrowing`). `fitAt` answers `out-of-bounds` below the last row, `firstFree` and Sort use only those cells, and every path that auto-places an item in a stash returns false when there is no room: `addItem`, `sendToStash`, `unarchive`, `detach`, `deleteItem` (contents and attachments), `updateItem` (location, footprint or status change), a drag out of the Archive, `splitStack`, and `switchLoadout` / `settleLoadout` (null when an item going home has nowhere to go). The store then keeps the inventory as it was and the UI shows the refusal: `move` answers reason `'full'` (the tile flashes), Move to Stash, Unarchive and Delete flash the tile, the Add and Edit forms show `Not saved · <reason>`, and a refused loadout switch shows a `--bad` banner (`uiStore.notice`).
- Load migration for the fixed grid: a stash home that runs past the last row or column is re-placed at the first free cells of its stash; when there are none it stays where it is and `stashMisfits` names it, and the store sets `loadError` to `No room in the stash for: <names>` (the banner, with the inventory still loaded). Nothing is dropped. On the real data the USA stash uses 58 rows, so nothing moves (`realdata.test.ts`).
- Stash grids stay mounted (`useRetainedGrids`, `StashColumn`): one per location plus the Archive, the one on screen first in DOM order, the others mounted when the browser is idle after first paint and kept at `display: none`. A location switch or the Archive toggle only flips which one shows, so tiles and decoded images are reused (one frame, about 16 ms, against about 80 ms when the grid was swapped). Memory is bounded by `settings.locations` (a removed location unmounts; an added one mounts; a rename swaps the key, and the store's `stashLocation` follows it, so the open grid stays on screen; `useRetainedGrids.test.tsx`). Only the grid on screen follows the filter strip and search; the stash scroller still resets to the top on a switch.

## Slot rules (`src/model/engine/slotRules.ts`)

Strict, like EFT: a slot takes only items whose category or one of whose tags is in its list. `canFit` applies this to every slot target and `equip()` uses it to pick a slot. The carry slots also require a container (an item with panels). A slot not listed (a custom slot added to one loadout) takes anything; Pockets is a grid, never a slot target.

| Slot | Accepts (category or tag) |
| --- | --- |
| Head | accessories |
| Eyes | eyewear |
| Ears | electronics, accessories |
| Neck | accessories |
| Wrist | accessories, electronics |
| Torso Base | tops |
| Torso Mid | tops |
| Torso Outer | outerwear, tops |
| Hands | accessories |
| Legs | bottoms |
| Underwear | underwear |
| Socks | underwear, accessories |
| Feet | footwear |
| Backpack, Carry-on, Pouch | bags and cubes, and must be a container |

**Stash-only categories** (`STASH_ONLY_CATEGORIES`, today `furniture`): EFT refuses cases and junk boxes inside a backpack even when they would fit by size, through the container's exclusion filter. Ragman does the same with a category list: a furniture item is refused by every container panel (`fitAt` answers `not-accepted` before the bounds check, so quick move, Ctrl-drag and Sort into a container all refuse it) and is in no slot list, so it lives only in a stash grid. Its own panels (the ALEX drawers) still take anything.

`equip(id)` without a slot tries the item's preferred slots first (its tags, then its category), skipping taken slots and slots not in the loadout, then every other slot of the loadout in order:

| Category or tag | Preferred slots, in order |
| --- | --- |
| tops | Torso Base, Torso Mid, Torso Outer |
| outerwear | Torso Outer |
| bottoms | Legs |
| underwear | Underwear, Socks |
| footwear | Feet |
| eyewear | Eyes |
| electronics | Ears, Wrist |
| accessories | Wrist, Neck, Head, Hands |
| bags and cubes | Backpack, Carry-on, Pouch |

The real data's slot placements (Filson Journeyman in Backpack, MW Drift in Carry-on, Apple Watch Ultra 4 in Wrist, JINS 221 in Eyes via its `eyewear` tag) all pass; `realdata.test.ts` checks every slot placement in every loadout against these rules.

## Sort

The Sort button repacks one grid (a stash only inside its `stashWidth` x `stashRows` cells) in the order of `filters.sort`, first-free top-left, rotating an item only when its unrotated form does not fit: `size-desc` biggest area first (then category, then name), `name` alphabetical, `category` in `settings.categories` order then name, `status` in `settings.statuses` order (blank last) then name. Pinned and locked items stay exactly where they are and everything else packs around them. All-or-nothing: if anything cannot be packed, nothing moves.

## EFT inventory fields

All optional. `normalize` never adds them and a save never writes one that was not set; the boolean setters write `true` and remove the key on `false` (absent means false). `exportJson` keeps them (it strips only `hidden`).

| Field | On | Meaning | Engine |
| --- | --- | --- | --- |
| `pinned` | item | Sort leaves it in place and packs around it | `setPinned`, `sort.ts` |
| `locked` | item | cannot be moved, equipped, archived, unarchived, sent to the stash, deleted, merged or split until unlocked; a Quick Use pin and edits that do not move it are still allowed; it still travels inside its container; a container is not deleted while it would have to move a locked item out | `setLocked`; `canFit` and `move` answer reason `'locked'`; the other moves return false |
| `verified` | item | false or absent = unverified, drawn with a "?" mark until the owner ticks it on the card; the stash header's Verify all ticks every item in the inventory in one undo step (Unverify all when none is left) | `setVerified`, `setVerifiedAll`, `unverifiedIds` |
| `weightEstimated` | item | `weight_g` is a guesstimate, not a scale or spec figure; summed like any weight but counted in `WeightSummary.estimated`, so every readout that includes it shows `~` and `N est.` (the card: `~450 g · estimate`); cleared whenever the weight is blank | `updateItem` (the Edit form's `est.` tick), `weights.ts` |
| `nickname` | container | shown on the tile label strip instead of the name; a blank removes it; refused on a non-container | `setNickname`, `updateItem` |
| `quantity` | consumable | stack size, integer >= 1, absent counts as 1; refused on a non-consumable | `quantityOf`, `mergeStacks`, `splitStack` |
| `unlocks` | task | task ids; when the task becomes completed (`setTaskStatus` or `updateTask`), each listed task that is `locked` becomes `active` | `engine/tasks.ts` |

Stacks (`engine/stacks.ts`, moves in `engine/moves.ts`). Two items are the same product when both are consumable and name, maker, color and size are equal (a blank equals only a blank). `canFit` answers a grid drop whose occupied cells all belong to one unlocked identical stack with `ok: true, merge: <id>`, and `move` then merges: the target's quantity becomes the sum, the dragged stack is deleted, and its Quick Use pin, task `itemId` and auto objectives now name the target. `splitStack(id, n, target?)` takes 1 <= n < quantity off into a new item `<id>-2` (the first free `-k`), a copy of the product without `pinned`, placed at `target` (default: the first free cells of the stack's grid, else its stash); a target that is not a home (pockets, a carried bag, a slot) also gives it a stash home; a target that is an identical stack merges the n into it; dropping it back on its own stack is refused.

Reads and moves for the EFT menus: `sameJob(id)` (the "filter by item" highlight) returns every other item with the same category and, when the item has tags, the same set of tags. `quickMoveInto(id, containerId)` places the item at the first free cells of the container's first panel, in panel order, that accepts it and has room, through the same checked move as a drop; its reason when nothing fits is `locked`, `self`/`cycle`, `occupied` (a panel accepts it but is full) or `not-accepted`.

## Structure edits (`engine/structure.ts`)

Panel sizes, slot lists and attachments are edited in the tool, never by hand in the file.

- `setPanels(id, panels, from?)` replaces a container's panels (any item can gain panels and become a container). `from[i]` is the old name of `panels[i]` (null for a new one), so a rename rewrites the `panel` of every home and placement inside it. Contents that no longer fit (a smaller grid, a removed panel, a new accepts or region) are re-placed by the footprint-edit rule (`refit`). Refused: an empty list, a blank or duplicate panel or region name, cells that are not whole numbers 1 to 40, a region outside its grid, or any edit that would move a locked item. `ItemPatch` still leaves `panels` out: the Edit form calls `setPanels`, then `updateItem` (which writes `weightLimit_g`, `quantity`, `panelLayout`).
- `setLoadoutSlots(slots)` and `setPocketsGrid([w, h])` edit the active loadout. A placement in a removed slot (or in the pockets when Pockets is removed) is deleted and the item goes home; after either edit the loadout is re-settled as on a switch (`settleLoadout`: placements first, then homes). Refused when a locked item would move.
- Stash tabs (`settings.locations`, in tab order): `addLocation(name)`, `renameLocation(from, to)`, `removeLocation(name)`, `moveLocation(name, -1 | 1)`, each one undo step. Names are trimmed; a blank name or one already in the list (any case) is refused, except that a rename may change the case of its own name. A rename rewrites `settings.locations`, every `item.location` and every stash home's `location` in the same step, and the store's `stashLocation` follows it. A remove is refused for the last tab and while any item names it (`itemsAt`: its `location`, or a stash home there, which covers items in the stash, carried items and archived items); after a remove the store shows the first tab. An undo shows the tab at the same place in the restored list. `setStashRows(n)` sets the rows of every stash: a whole number from `minStashRows` (the lowest bottom edge of any stash home, homes of carried items included) to 200.
- `attach(id, parent, slot)` / `detach(id)`. An attachment slot takes an item whose tags or category include the slot name (`band` takes items tagged band). Attaching removes the item's home and every loadout placement (it goes where the parent goes; its Quick Use pin stays); an item already in the slot is detached first (a swap). A detached item gets a home at the first free cells of its stash (the Archive when Not Worn). Refused: locked item or locked occupant, self, a cycle (the parent sits inside the item), a slot the parent does not offer. `canAttach` and `attachTargets` are the reads the menu and the drag use.

## Overall (`engine/overall.ts`)

`overallSummary(inv)` returns the Overall tab's numbers as one plain object; the store memoises it per `inv` (`overallSummary()` in `api.ts`).

- `byStatus`, `byLocation`: counts in `settings` order, zero rows kept; a value found in the data but not in `settings` comes after them; the blank value (`name: ''`) comes last, only when some item has none.
- `loadouts`: for every loadout, the count and weight of `carriedIds(inv, links, name)`, the same set the footer's carried weight sums (slots, pockets, carried-container contents, attachments). `carriedIds` and `carriedWeight` take an optional loadout name for this; it defaults to the active one. A loadout that is not on screen is read as stored, without the settle a switch runs; `realdata.test.ts` checks that on the real data this equals the footer's figure after switching to it.
- `stashes`: each location's stash, then the Archive, as the active loadout draws them. A stash's fill is occupied cells over its fixed grid, `stashWidth × stashRows` (`rows` is `stashRows`), so an empty stash reads 0%. The Archive grows, so its fill is occupied cells over the rows in use: `width × (bottom-most occupied row + 1)`; an empty Archive has `fill: null`.
- `emptyContainers`: items with panels where no item sits in any panel at the active loadout's placement, with where each is drawn (a grid or a slot).

The Export button downloads `exportJson()` from `engine/strip.ts`, the same export that drops `hidden` from every item.

## Data flow

```
boot() -> persist.load() -> inv in store -> React selectors -> screen
               ^                                  |
               +---- debounced persist.save() <---+ (every mutation)
                          |
                          v
   PUT /data/inventory.json -> server writes the file -> sync.schedule()
                                                            |  20 s quiet
                                                            v
                         git add, commit, pull --rebase, push -> GET /data/sync -> footer
```

`effectivePlace(id)` = `loadouts[active].placements[id] ?? items[id].home`; an attached item resolves to its parent's place. Grids are derived from effective places on demand (`gridView`) and memoised per `inv` reference.

## Sync (`scripts/sync.mjs`)

One module, imported by `vite.config.ts` and `scripts/serve.mjs`; both call `syncFromEnv(dataDir)`, `afterPut` after a successful PUT and `handleSyncRoute` for `/data/sync`. Git runs through `execFile` with argument arrays.

- Startup, before the first request is answered: if the data dir is the top of a git repo with an upstream, commit any changes, `git pull --rebase --autostash` once, push if ahead. A failure (offline) leaves state `error` and the server still serves. `RAGMAN_SYNC=0`, no repo, no upstream, or a vitest run: state `off`, one log line says why.
- After a PUT of `inventory.json` or an image: wait `RAGMAN_SYNC_DELAY_MS` (default 20000) after the last save, then one sync at a time: `git add -A -- . ':(exclude,icase)*prices*' ':(exclude).claude'`; commit `Layout <ISO time> from <hostname>` when something is staged; when nothing is staged and nothing is unpushed, stop; else pull with rebase and push.
- Push rejected or no network: state `error` with the git message; the commit stays; the next save or a POST retries.
- Rebase conflict: `git rebase --abort`, state `error` with message `conflict: pull by hand`, `conflict: true`, and no automatic sync until the server restarts or a later POST sync ends without a conflict (success or another error; after another error the next save syncs again).
- A save that lands after `git add` is carried through the pull by `--autostash`. When it clashes with the pulled commits, git still exits 0 and leaves conflict markers in the file. The sync then writes back the stashed version of each conflicted file (the page's last save), marks it resolved with `git add`, drops the autostash and stops as a conflict, without pushing. Unmerged files with no new autostash are a conflict too.
- State: `off | idle | pending | syncing | synced | error`, `lastAt`, `message`, `ahead` (unpushed commits), `conflict`. `GET /data/sync` returns it; `POST /data/sync` syncs now and returns it; the PUT of `inventory.json` answers with it (200, JSON).
- Client: `persist.fetchSync` reads or runs it; the store keeps `syncState`, `syncAt`, `syncMessage`, `syncConflict`, reads once on load, polls every 5 s while `pending` or `syncing`, and once 25 s after each save. The folder and bundled sources stay `off`.
- The page reads `inventory.json` once on load; a change pulled while the page is open is overwritten by the next save unless the page is reloaded.

## Builds

- `npm run dev`: private build; the Vite plugin serves `../ragman-data` (or `RAGMAN_DATA`) at `/data/*`.
- `npm run build && npm run serve`: production private build with the same endpoints from `scripts/serve.mjs`.
- `npm run build:public`: `VITE_BUILD=public`, bundles `data/demo/inventory.json` and `data/demo/images/*`, `source.kind === 'bundled'`, edits reset on reload. Deploys to `logos52.github.io/ragman`.
