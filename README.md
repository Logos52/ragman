# Ragman

An EFT inspired inventory management system.

Ragman is a personal catalog of everything you own, laid out like the Escape from Tarkov inventory screen: the person with equipped slots on the left, carried containers in the middle, the Stash grid on the right. It exists to give a bird's-eye view of every item so nothing is wasted or bought twice, and to make packing for a trip feel like building a loadout.

Named after the Tarkov trader who sells clothing and gear. On screen the app is called "Inventory".

## Layout of this repo

| Path | Holds |
| --- | --- |
| `schema/inventory.schema.json` | the formal schema for `inventory.json` |
| `data/demo/` | demo data for the public build, pre-approved items only |
| `docs/` | the PRD and design notes |
| `src/` | the app (not yet started) |
| `scripts/` | import, validate and icon helpers (not yet started) |

The real inventory lives in the private `ragman-data` repo and is never committed here.

## Principles

- Nothing is guessed. A value with no source stays blank.
- No prices, no buying decisions.
- Status describes use, never purchase.
- Snappy like a video game. No interaction waits on the network.
- Layout very close to EFT, slightly brighter palette.
