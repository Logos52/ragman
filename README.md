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

## License and affiliation

Ragman is licensed under the GNU Affero General Public License v3.0; see `LICENSE`. The author holds the copyright and may offer other licenses separately. Outside code contributions are not accepted yet; see `CONTRIBUTING.md`.

Ragman is a fan-made personal tool inspired by the inventory screen of Escape from Tarkov. It is not affiliated with, endorsed by, or connected to Battlestate Games, and it contains none of the game's assets, icons, fonts or artwork.

## Principles

- Nothing is guessed. A value with no source stays blank.
- No prices, no buying decisions.
- Status describes use, never purchase.
- Snappy like a video game. No interaction waits on the network.
- Layout very close to EFT, slightly brighter palette.
