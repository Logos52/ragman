# Ragman PRD

Oct 28, 2026 · Wedge · living copy: https://claude.ai/artifact/Xn3Djaou8A739EeUrmcJb2

## Purpose

Ragman is an EFT-inspired inventory management system: a personal catalog of everything Wedge owns, shown on screen under the name "Inventory", laid out like the Escape from Tarkov (EFT) inventory screen, so every item is visible at once and nothing is wasted or bought twice.

It is a mix of packing, auditing and arranging. The first real use is the trip to Vietnam: build the loadouts that fly, see what stays in the USA stash, and confirm that each item is necessary. Wedge's own words: "the goal is not to waste anything and have a birds eye view of every item that I own to make sure everything I have is necessary, and anything I want to buy isn't already covered by something. It's sort of like a fun packing list."

The tool replaces the Notion mirror as the single source of truth.

## Goals and non-goals

The tool succeeds when the Vietnam loadouts are built in it, every owned item is placed somewhere, and it feels like playing the game rather than filling a spreadsheet.

Goals:

- Every item Wedge owns is visible in one place: on the person, in a carried container, in a stash, or in the Archive.
- Packing for a trip is done by dragging items into a loadout and ticking a Task list.
- Redundancy is visible by eye: two items that do the same job sit near each other in the grid.
- Snappy and fast, like a video game. Drag, drop, open and hover respond instantly with no page reloads and no spinners. Target: every interaction under 100 ms, grid renders under one frame.
- Layout and feel are very close to EFT, so no learning curve.
- Nothing is guessed: a value with no source stays blank.

Non-goals:

- Prices and buying decisions. The .prices.txt file is never opened. The tool shows coverage, not what to buy.
- Fabric and care details on screen. They are logged but hidden.
- Photos of the model. Item-only images.
- Health and Map tabs.

## Layout

The Gear screen copies the EFT inventory screen: tabs across the top, the person on the left third, carried containers in the middle third, the Stash grid on the right third.

| Region | What it shows | EFT equivalent |
| --- | --- | --- |
| Top tabs | Overall, Gear, Skills, Tasks | Same, minus Health and Map |
| Left third | Silhouette with labelled slot boxes for the current loadout, loadout picker above it | Earpiece, Headwear, Body Armor, etc. |
| Middle third | Stacked carried containers, mostly everyday-carry items: Pockets, Backpack, Carry-on, Pouch. Each bag shows only its main compartment grid here; its other panels, like the Filson's glasses pocket and front pouch, appear only in the bag's opened window | Tactical Rig, Pockets, Backpack, Pouch |
| Right third | Stash grid for the current location, with a category filter strip on its left edge and search and sort at the top | Stash |
| Bottom left | Total carried weight in kg, summed from every item in the active loadout including container contents and attachments, with a count of items that have no weight yet. No limit on the person. Limits live on containers: a suitcase or carry-on with a weightLimit\_g set shows its own total in its header and turns red past the limit, so a bag can be packed to an airline allowance | Weight and body stats |
| Bottom bar | Quick Use row for staples | Quick Use |

Visual style: EFT's layout and cell language, but slightly brighter than EFT, not as dark or brooding. Keep the same cell borders, labels in the top-right of each item cell, container cells with a highlighted border. Fonts and colors may lean on the Pocket Vietnam sheet Wedge likes. The figure on the left is an illustrated avatar, Studio Ghibli-inspired, in the style of the cast portraits on tsumugu.cc, and modelled on the Shen Wen portrait there: short dark hair, brown-framed glasses, a calm half smile, soft cel shading, muted teal and cream palette, clean linework. Drawn full-length in a neutral standing pose so the slot boxes sit around it. In v1 the figure is one fixed drawing and the equipped items show in the slot boxes, not on the body. Redrawing the figure per loadout is v1.1, if Grok can keep the character consistent. It is a drawing, not a photo of Wedge. Desktop browser first. The top-right currency readout is dropped.

Reference screenshot: the EFT inventory screen Wedge supplied on Oct 28, 2026, plus the Reddit newcomer thread linked in the packet.

## Core concepts

Every item is in exactly one place at a time: a slot on the person, a panel of a container, a stash, or the Archive.

- **Item.** One physical thing Wedge owns. Has a footprint in cells, a status, a location, images and notes. Stackable items like vitamin packets carry a quantity.
- **Slot.** A labelled box on the person for something worn on the body. Default list: Head, Eyes, Ears, Neck, Wrist, Torso Base, Torso Mid, Torso Outer, Hands, Legs, Underwear, Socks, Feet, Pockets, Backpack, Carry-on, Pouch. Slots can be added or removed per loadout. If a thing goes inside something, it is an item, not a slot. The Sleeper Hold Travel Pillow is an item in the carry-on.
- **Container.** An item that holds other items. Has one or more named panels, each with a grid and an optional accepts filter. Containers nest: packing cubes inside the Filson. Right-click Open shows the nested grid.
- **Loadout.** A named arrangement of what is on the person and in the carried containers. Starting set: Work, Plane, Winter, Summer. Carried containers mostly stay the same across loadouts; what is on the person changes. One item may appear in several loadouts. Switching loadouts redraws the person and the middle column; items not in the active loadout sit in their stash. Applying a loadout places its items; items the previous loadout used and this one does not return to the stash of their location, auto-placed in the first free cells.
- **Stash.** The big grid for everything not in the active loadout, one stash per location. Starting set: USA, Vietnam. Location is a required field.
- **Archive.** A second Stash view that gathers every item with status Not Worn, across all locations. Each cell carries a location tag. Marking an item Not Worn moves it to the Archive; dragging it out clears the status.
- **Task.** A quest-style checklist. Packing lists and chores.

* **Attachment.** A child item fixed to a parent in a named attachment slot, like an EFT weapon mod. The Apple Watch Ultra 4, Titanium Natural, has a band slot holding the Dark Umber Trail Loop M/L. The Burgundy Trail Loop S/M is a separate item in the Stash, kept because it is small, with the lesson that its color and size are wrong. Attachments move with the parent and show on its Inspect card. The test for attachment versus container: a band stays on the watch for months, so it is an attachment; glasses leave their case every day, so the case is a container with a one-panel grid that accepts eyewear. Wedge has two glasses cases and two pairs of glasses but wears one pair, so one case sits empty in the stash, which is the kind of redundancy the tool should make visible.
* **Duplicate.** Three identical tees are three items with three cells, as in EFT, so each carries its own lesson and wear.

## Grid rules

Cells are relative, as in EFT, not a fixed number of centimeters. Footprints are set by feel against anchors, and bag grids borrow EFT sizes.

- **Anchors.** Folded tee 2x2, 14-inch MacBook Pro 4x3, Anker 733 power bank 2x1, USB charging cable 1x1, handkerchief 1x1, microfiber cloth 1x1, vitamin packet 1x1 stackable.
- **Default footprint.** An item with no footprint set shows as 1x1 until Wedge sets it.
- **Rotation.** Items rotate 90 degrees with R while dragging, as in EFT. A 1x2 cable can sit 2x1.
- **Panels.** A container has one or more named panels. Each panel is its own grid. In the middle column a bag shows only its main panel; all panels show in the bag's opened window, with unused ones collapsed behind a plus button. The container's header shows its summed weight, bag plus contents, with a count of unweighed items, and an optional limit.
- **Reserved regions.** A panel can reserve a block of cells inside its grid, drawn with its own border, that only accepts flagged items. The laptop sleeve is a region inside the main compartment, so it counts toward the main grid's size.
- **Accepts filter.** A panel or region can restrict what it takes: laptop only, flat items only, band only.
- **Fit rule.** An item can only be dropped where every cell of its footprint is free and the panel accepts it. Invalid drops snap back with the EFT red highlight.

* **Stash width.** 10 cells wide and scrolling down, as in EFT.
* **Pockets.** A fixed panel on the person, 4x1 by default for phone, wallet, keys and AirPods, resizable per loadout when more is carried.

EFT backpack grids used as the scale ([Backpacks, EFT Wiki](https://escapefromtarkov.fandom.com/wiki/Backpacks)):

| Slots | Grid | EFT backpack |
| --- | --- | --- |
| 48 | 6x8 | 6Sh118 raid backpack |
| 42 | 6x7 | Mystery Ranch Blackjack 50 |
| 35 | 5x7 | Pilgrim, SSO Attack 2 |
| 30 | 5x6 | Camelbak Tri-Zip, 2 Day Assault Pack |
| 25 | 5x5 | LBT 3Day Pack |
| 20 | 4x5 | Scav BP, LBT Day Pack |
| 16 | 4x4 | Flyye MBSS |
| 12 | 4x3 | Duffle bag |

Filson Journeyman backpack, otter green, 23 liters:

| Panel | Grid | Rule |
| --- | --- | --- |
| Main compartment | 6x8, with a 4x3 laptop region inside | region accepts laptop only |
| Glasses pocket | 3x3 | anything that fits; Filson's name for it, but few people put glasses there. Planned contents: the Anker 733 at 2x1, the charging cable 1x1, a handkerchief 1x1. A 4x3 laptop cannot fit |
| Front pouch | 4x2 | anything, usually left empty by choice |

Mission Workshop Drift laptop tote, black camo, 28 liters, the carry-on ([product page](https://missionworkshop.com/products/drift-laptop-tote-bag?variant=31730589794413)):

| Panel | Grid | Rule |
| --- | --- | --- |
| Main compartment | 8x7, with a 5x3 laptop region inside | region accepts laptop only |
| Phone pocket | 1x2 | anything small |
| Organizer pocket | 3x2 | anything |
| Mesh pocket A, Mesh pocket B | 2x2 each | anything |
| External flat pocket | 4x3 | flat items only; fits the M4 iPad, which stays out by choice |
| Document pocket | 4x3 | flat items only |

All panel sizes are starting guesses that Wedge adjusts in the tool.

## Interactions

Three layers, as in EFT: hover for a quick tooltip, right-click for a menu, Inspect for the full card.

| Action | Result |
| --- | --- |
| Hover an item | Tooltip after a short delay: name, status, footprint, short note |
| Right-click an item | Context menu: Inspect, Equip to slot, Move to Stash, Archive, Add to Quick Use, Edit, Delete |
| Right-click a container | Same menu plus Open at the top |
| Inspect | Card with the real photo, every shown field, the maker link, lesson, location |
| Drag | Item follows the cursor; valid cells highlight green, invalid red; drop snaps to grid; R rotates |
| Open a container | Nested grid window, movable, several can be open at once |
| Double-click a container | Open, same as the menu |
| Loadout picker | Dropdown above the person; switching redraws left and middle columns instantly |
| Stash header | Location switcher and the Archive toggle |
| Filter strip | Category icons on the Stash's left edge, plus search and sort at the top |
| Quick Use row | Staples pinned to numbered boxes along the bottom |
| Add item | Plus button on the Stash opens the edit form; paste a screenshot, type a name, save; new items land in the Stash as 1x1 until sized |

Shortcuts, as in EFT: Ctrl-click sends an item to the Stash, Alt-click equips it, R rotates while dragging, Sort auto-arranges the Stash. Ctrl-Z undoes the last move, ten steps deep.

Speed is part of the spec. All state lives in memory in the browser and saves in the background. No interaction waits on the network. Grid moves animate in under 100 ms or not at all.

## Item data model

Status describes use, never purchase. Everything is bought, so bought is not a value. A field with no source stays blank.

| Field | Where it shows | Notes |
| --- | --- | --- |
| name | cell label, tooltip, card | official product name |
| icon | grid cell | cartoon, square, item only |
| photo | card | real, high-res, item only, from the maker's site |
| maker link | card | official product page, as on logos52.github.io/personal |
| status | tooltip, card, filter | Daily, Rotation, Seasonal, Travel Only, Not Worn, Retired |
| footprint | grid | w x h cells, blank shows as 1x1 |
| rotated | grid | yes or no |
| quantity | cell corner | consumables only, optional, not tracked in v1 |
| weight | bottom-left total | grams, from the maker's spec or a kitchen scale, blank if neither; blank items are counted as unweighed in the total, never estimated |
| category | filter strip | tops, bottoms, outerwear, footwear, accessories, electronics, bags and cubes, consumables |
| location | Stash, Archive tag | USA, Vietnam |
| inside | grid | parent container and panel, or slot, or stash |
| position | grid | cell x, y inside its panel |
| staple | Quick Use | yes or no |
| note | tooltip, card | one short line |
| lesson | card | what worked or did not: itchy, hard to wash, size up at Uniqlo |
| panels | containers only | list of name, grid, accepts, reserved region |
| size | card | the garment size |
| fabric, care, source | hidden | logged, never shown |
| attachment slots | card | named slots this item offers: band, case, charger |
| attachments | card | child items by slot, move with the parent |
| special care | card badge | yes or no; the care details themselves stay hidden |
| consumable | card | yes or no; rebought when out, no count kept |
| weightLimit\_g | container header | containers only, optional; an airline allowance such as 23000 for a checked bag or 7000 for a carry-on; header turns red when contents plus bag exceed it |
| nameEn | card | optional English name when the official name is in Traditional Chinese, as Machismo's are |

Under review and not in v1: slot preference, heat, fit, set, condition, in\_rotation, role.

Lesson prompts, from the spectator's notes: itch, uneven front and back panel weight, hard to wash, shrinkage or degrading after a wash, too skinny, size up at Uniqlo to XL, smell and mold in humidity, black clothing with some color in accessories, no black bags.

## Tabs beyond Gear

Tasks is the packing list and ships in v1. Overall is a summary. Skills is a personal tracker and ships after.

**Tasks.** An EFT quest log. Each task has a title, a description, a list of objectives with checkmarks, and a status of active, completed or locked. Two kinds:

- Packing tasks, like "Pack for Vietnam". An objective such as "MacBook Pro in the Filson" ticks itself when the item is dragged there. Loose objectives are ticked by hand. Any task exports as a plain checklist for paper or the phone.
- Chores, like "Wash the Uniqlo linen shirt" or "Replace the watch band". Linked to an item, ticked by hand.

**Overall.** A read-only profile page: item count, count per status, count per location, items per loadout, total carried weight per loadout, how full each stash is, and a list of empty containers, like the spare glasses case.

**Skills.** A tree of skills Wedge is working on, grouped like EFT. Agentic work is a base skill with Grok Bot and Claude as children that share it. Mindsets is another group. Each skill has a level, a progress bar set by hand, and a note. Nothing accrues automatically.

**Health and Map.** Dropped.

## Images

Each item has two images: a cartoon icon for the grid and a real photo for the Inspect card.

- **Grid icon.** Cartoon, one uniform style across the whole inventory, item only, square, transparent background. Generated by Grok from the real photo or a pasted screenshot, with a prompt that fixes the style and the footprint's aspect ratio, so a 4x3 MacBook icon fills a 4x3 block and the grid reads as one piece. Wedge approves each icon before it replaces the placeholder. Multi-cell items are drawn to fill their footprint, as EFT does for rifles and bags.
- **Inspect photo.** The real product photo from the maker's site, high-res, item only. Low-res images are rejected. No photo of a model wearing it.
- **Containers.** The middle column shows the bag's own photo large, as EFT shows the backpack, with its panels below or beside it.
- **Missing image.** A grey placeholder with the item name. Never a stand-in photo of a similar item.

Sources for the fields, checked Oct 28, 2026. Most clothes come from [Machismo](https://www.machismo.com.tw/), a Taiwanese men's store on SHOPLINE. Its product pages give the official name in Traditional Chinese, fabric composition, care note, color and sizes, so name, size, fabric and care import from the page. They do not list garment weight, so Machismo pieces are weighed on a kitchen scale. Their photos are on a model and embedded in the page, so the Inspect photo is a cropped screenshot pasted in, or a Grok flat-lay made from it. There is no product feed, so import is one item at a time. Names stay in Traditional Chinese as the store writes them, with an optional English name beside it.

## Data and storage

The web tool is the source of truth. The project is Ragman, an EFT-inspired inventory management system, named after the Tarkov trader who sells clothing and gear. It lives in two GitHub repos: ragman, public, holds the app, the schema, scripts and a demo data folder, and deploys to logos52.github.io/ragman; ragman-data, private, holds the real inventory.json and the images folder. One codebase, two builds.

| Build | Who sees it | Data |
| --- | --- | --- |
| Private | Wedge only | every real item, edits persist |
| Public | anyone | dummy values and a set of items Wedge pre-approves, edits do not persist |

- **Storage.** One JSON file, inventory.json, replacing items.db. The browser loads it whole into memory, so every interaction is instant, and writes it back debounced in the background through the File System Access API or a tiny local server. Images sit beside it in an images folder, one file per item for the photo and one for the icon, referenced by path from the JSON. A screenshot pasted into the edit form with Ctrl-V is saved there automatically, so adding an item is paste, name, done. This is the simpler backend the Notion mirror could not be: Notion is hard to edit by hand, so its existing rows are imported once and it is retired. A few hundred items is far below what needs a database; a JSON file is readable, diffable in git, and the public snapshot is a filtered copy of it. Attachments, nesting and loadouts are plain references between ids.
- **Public build.** Ships a frozen JSON snapshot of the pre-approved items with the same schema. Anything a visitor drags resets on reload. Nothing private is in the bundle.
- **Notion.** One-time import from the Notion mirror, then retired. Some earlier Notion values were invented by a bot, so each imported value is checked against a source before it is kept. Unverified values import as blank.
- **Prices.** The .prices.txt file is never read by either build.
- **Backup.** items.db is exported as JSON on demand from the Overall tab.

## Release plan

v1 is what the Vietnam trip needs: Gear and Tasks, two loadouts, two stashes, the Filson and the Drift.

**v1, for Vietnam packing**

- Gear screen with person, middle column, Stash, Archive, filter strip, Quick Use, summed weight total
- Items with footprints, rotation, stacking, hover, right-click menu, Inspect card, edit form
- Containers with panels, reserved regions, accepts filters, nested Open
- Loadouts Work and Plane, stashes USA and Vietnam
- Tasks tab with packing tasks that tick on drag
- Private build on items.db, Notion import with verification
- Filson Journeyman and Mission Workshop Drift modelled with their panels

**v1.1, after the trip**

- Skills tab with manual progress
- Overall tab
- Winter and Summer loadouts
- Public build with pre-approved dummy items
- Role field for spotting redundancy, if eyeballing proves not enough

## JSON schema

One file, inventory.json. Every item has a home in a stash; a loadout is an overlay that moves some items onto the person and into carried containers. What you see is the active loadout's placement where it has one, otherwise the home.

Top level:

| Key | Type | Holds |
| --- | --- | --- |
| version | number | schema version, starts at 1 |
| settings | object | the lists the UI is built from: statuses, categories, locations, defaultSlots, stashWidth |
| items | map of id to Item | every physical thing, containers included |
| loadouts | map of name to Loadout | Work, Plane, Winter, Summer |
| activeLoadout | string | name of the loadout on screen |
| archive | object | width, nothing else; membership comes from status Not Worn |
| quickUse | array of 10 | item ids or null, left to right |
| tasks | array of Task | packing lists and chores |
| skills | array of SkillGroup | the Skills tab |

Item:

| Field | Type | Notes |
| --- | --- | --- |
| id | string | slug, never renamed: apple-watch-ultra-4; a second identical product gets a numeric suffix. A uid field can be added later by a migration script without changing references, since references stay slugs |
| name | string | official product name |
| maker | string | brand |
| makerUrl | string | official product page |
| category | string | one of settings.categories |
| status | string | one of settings.statuses |
| location | string | one of settings.locations, USA or Vietnam |
| size | string or null | garment size |
| footprint | \[w, h\] or null | null draws as 1x1 |
| weight\_g | number or null | blank if unknown |
| tags | string array | optional properties that accepts filters match, beside the category: laptop, flat, band, liquid. Most items have none |
| staple | boolean | eligible for Quick Use |
| consumable | boolean | rebought when out, no count |
| specialCare | boolean | badge on the card |
| note | string | one short line |
| lesson | string | what worked or did not |
| images | object | icon and photo, paths relative to the images folder |
| hidden | object | fabric, care, source; logged, never shown |
| attachmentSlots | string array | slots this item offers: band |
| attachedTo | object or null | {to: item id, slot: name}; an attached item has no home |
| panels | Panel array | containers only |
| home | Place | where it sits when no loadout claims it |

Place, one of:

| kind | Fields | Meaning |
| --- | --- | --- |
| stash | location, x, y, rotated | a cell in that location's stash |
| archive | x, y, rotated | a cell in the Archive grid |
| panel | in, panel, x, y, rotated | inside a container's panel; the container is in a stash or a loadout |
| slot | slot | on the person, loadouts only |

Coordinates are 0-based from the top-left. rotated true swaps w and h.

Panel:

| Field | Type | Notes |
| --- | --- | --- |
| name | string | Main, Glasses pocket, Front pouch |
| grid | \[w, h\] | cells |
| accepts | string array or null | names allowed; each name matches an item's tag or its category; null means anything |
| regions | Region array | reserved blocks inside the grid |
| Region.name | string | Laptop sleeve |
| Region.at | \[x, y\] | top-left cell inside the panel |
| Region.size | \[w, h\] | cells |
| Region.accepts | string array | names allowed in the region, matched against tags or category |

Loadout:

| Field | Type | Notes |
| --- | --- | --- |
| slots | string array | the slot list for this loadout, from defaultSlots plus or minus |
| placements | map of item id to Place | kind slot or panel only |
| pocketsGrid | \[w, h\] | default \[4, 1\] |

Task:

| Field | Type | Notes |
| --- | --- | --- |
| id, title, description | strings | quest text |
| status | string | active, completed, locked |
| objectives | Objective array |  |
| Objective.text | string | MacBook Pro in the Filson |
| Objective.done | boolean | ticked by hand or by the rule |
| Objective.auto | object or null | {item, in: container id or slot name, loadout}; ticks itself when true |
| itemId | string or null | the item a chore belongs to |

SkillGroup and Skill:

| Field | Type | Notes |
| --- | --- | --- |
| group.name | string | Agentic work, Mindsets |
| group.skills | Skill array |  |
| skill.name | string | Claude, Grok Bot |
| skill.parent | string or null | the base skill this one builds on |
| skill.level | number | hand set |
| skill.progress | number 0 to 1 | hand set |
| skill.note | string |  |

Example, illustrative values:

```json
{
  "version": 1,
  "settings": {
    "statuses": ["Daily", "Rotation", "Seasonal", "Travel Only", "Not Worn", "Retired"],
    "categories": ["tops", "bottoms", "outerwear", "footwear", "accessories", "electronics", "bags and cubes", "consumables"],
    "locations": ["USA", "Vietnam"],
    "defaultSlots": ["Head", "Eyes", "Ears", "Neck", "Wrist", "Torso Base", "Torso Mid", "Torso Outer", "Hands", "Legs", "Underwear", "Socks", "Feet", "Pockets", "Backpack", "Carry-on", "Pouch"],
    "stashWidth": 10
  },
  "items": {
    "apple-watch-ultra-4": {
      "name": "Apple Watch Ultra 4, Titanium Natural", "maker": "Apple", "makerUrl": "",
      "category": "accessories", "status": "Daily", "location": "USA",
      "footprint": [2, 2], "tags": [], "attachmentSlots": ["band"],
      "images": {"icon": "icons/apple-watch-ultra-4.png", "photo": "photos/apple-watch-ultra-4.jpg"},
      "home": {"kind": "stash", "location": "USA", "x": 0, "y": 0, "rotated": false}
    },
    "trail-loop-dark-umber-ml": {
      "name": "Trail Loop, Dark Umber, M/L", "category": "accessories", "tags": ["band"],
      "attachedTo": {"to": "apple-watch-ultra-4", "slot": "band"}
    },
    "trail-loop-burgundy-sm": {
      "name": "Trail Loop, Burgundy, S/M", "category": "accessories", "tags": ["band"],
      "lesson": "Wrong color and size, kept because it is small",
      "home": {"kind": "stash", "location": "USA", "x": 2, "y": 0, "rotated": false}
    },
    "filson-journeyman": {
      "name": "Filson Journeyman Backpack, Otter Green", "category": "bags and cubes",
      "panels": [
        {"name": "Main", "grid": [6, 8], "accepts": null,
         "regions": [{"name": "Laptop sleeve", "at": [0, 0], "size": [4, 3], "accepts": ["laptop"]}]},
        {"name": "Glasses pocket", "grid": [3, 3], "accepts": null, "regions": []},
        {"name": "Front pouch", "grid": [4, 2], "accepts": null, "regions": []}
      ],
      "home": {"kind": "stash", "location": "USA", "x": 0, "y": 2, "rotated": false}
    },
    "jins-new-classic-221": {
      "name": "JINS NEW CLASSIC No.1, model 221", "maker": "JINS",
      "makerUrl": "https://us.jins.com/collections/men-eyeglasses/products/jins-new-classic-221",
      "category": "accessories", "status": "Daily", "location": "USA", "tags": ["eyewear"], "footprint": [2, 1],
      "images": {"icon": "icons/jins-new-classic-221.png", "photo": "photos/jins-new-classic-221.jpg"},
      "home": {"kind": "panel", "in": "glasses-case-a", "panel": "Main", "x": 0, "y": 0, "rotated": false}
    },
    "glasses-case-a": {
      "name": "Glasses case A", "category": "accessories",
      "panels": [{"name": "Main", "grid": [2, 1], "accepts": ["eyewear"], "regions": []}],
      "home": {"kind": "stash", "location": "USA", "x": 4, "y": 0, "rotated": false}
    },
    "macbook-pro-14": {
      "name": "MacBook Pro 14", "category": "electronics", "tags": ["laptop", "flat"], "footprint": [4, 3],
      "home": {"kind": "panel", "in": "filson-journeyman", "panel": "Main", "x": 0, "y": 0, "rotated": false}
    }
  },
  "loadouts": {
    "Plane": {
      "slots": ["Head", "Eyes", "Wrist", "Torso Base", "Torso Outer", "Legs", "Socks", "Feet", "Pockets", "Backpack", "Carry-on"],
      "pocketsGrid": [4, 1],
      "placements": {
        "apple-watch-ultra-4": {"kind": "slot", "slot": "Wrist"},
        "jins-new-classic-221": {"kind": "slot", "slot": "Eyes"},
        "filson-journeyman": {"kind": "slot", "slot": "Backpack"}
      }
    }
  },
  "activeLoadout": "Plane",
  "archive": {"width": 10},
  "quickUse": ["macbook-pro-14", null, null, null, null, null, null, null, null, null],
  "tasks": [
    {"id": "pack-vietnam", "title": "Pack for Vietnam", "description": "", "status": "active", "itemId": null,
     "objectives": [
       {"text": "MacBook Pro in the Filson", "done": false,
        "auto": {"item": "macbook-pro-14", "in": "filson-journeyman", "loadout": "Plane"}}
     ]}
  ],
  "skills": [
    {"name": "Agentic work", "skills": [
      {"name": "Agentic work", "parent": null, "level": 1, "progress": 0.2, "note": ""},
      {"name": "Claude", "parent": "Agentic work", "level": 1, "progress": 0.5, "note": ""},
      {"name": "Grok Bot", "parent": "Agentic work", "level": 1, "progress": 0.1, "note": ""}
    ]}
  ]
}
```

Rules the file must keep:

- An item's home never overlaps another item's home in the same grid, footprint and rotation included.
- A loadout placement never overlaps another placement in the same loadout.
- An attached item has no home and no placement; it goes where its parent goes.
- The MacBook's home is inside the Filson, so it travels with the Filson into any loadout that equips the bag, with no placement of its own needed.
- A container's panel contents in a loadout come from placements first, then from homes inside that container.
- Deleting an item removes its placements, its attachments' links, and its Quick Use pin.

* A container's weight is its own weight\_g plus the weight of everything placed in its panels and attached to it, recursively; items with blank weight\_g add nothing and are counted as unweighed.

## Open questions

- [ ] Status list: confirm Daily, Rotation, Seasonal, Travel Only, Not Worn, Retired, or change it
- [ ] Default slot list: confirm or edit the fifteen proposed slots
- [ ] Weights: which items have a published weight, and which need the kitchen scale
- [ ] Filter strip categories: confirm the eight proposed
- [ ] Panel sizes for the Filson and the Drift, after the first real packing pass
- [ ] The rest of the Filson's usual contents beyond MacBook, cable, Anker 733, microfiber cloth, vitamin D and Zinc packets
- [ ] Which items are pre-approved for the public build
- [ ] Which project the tool lives under, and whether the phone matters for packing
- [ ] Grok prompt template per category for the icons and the avatar, in the tsumugu.cc portrait style, and how generated files get into the images folder
- [ ] Create the ragman and ragman-data repos, and decide whether ragman is public from day one or private until the demo data is ready

* [ ] Attachment slots per item kind: band for watches, case for glasses, charger for the MacBook, others
