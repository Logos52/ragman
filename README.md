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
| `src/` | the app: `model/` (types, store contract, engine, persistence), `ui/` (screens, drag, menus, windows), `styles/` (tokens, fonts) |
| `scripts/` | `serve.mjs` (production server), `shots.mjs` (Playwright proof), `icon-fit.py`, `link-grok.py`, `import_export.py` |
| `refs/` | local screenshots and references, gitignored |

The real inventory lives in the private `ragman-data` repo and is never committed here.

## Running it

Needs Node 22 and a clone of the private `ragman-data` repo beside this one (`../ragman-data`, or set `RAGMAN_DATA`).

```
npm install
npm run dev          # http://localhost:5173, serves ../ragman-data at /data/*, saves in place
npm run build && npm run serve   # production build with the same data endpoints
npm run build:public # public demo build (bundles data/demo, edits reset on reload)
npm test             # engine, store, real-data and UI-rule tests
npm run typecheck
npm run shots        # Playwright proof: refs/proof/*.png at 1440 and 390, perf.json, tests.txt
```

The dev and production servers refuse any path containing `prices` or `..`, and only `inventory.json` and `images/*` are reachable. Every mutation is in memory; the file is written in the background and the footer badge shows the save state.

Both servers also commit and push the data repo in the background, so the layout follows you between machines. When the data folder is a git repo with an upstream branch, the server first commits any uncommitted changes, pulls with rebase and pushes. After each save it waits for a quiet period, then commits (`Layout <time> from <hostname>`), pulls with rebase and pushes. Files whose name contains `prices` and the `.claude` folder are never staged. Nothing is force-pushed, reset or checked out.

| Env var | Default | Effect |
| --- | --- | --- |
| `RAGMAN_DATA` | `../ragman-data` | the data folder |
| `RAGMAN_SYNC` | on | `0` turns the git sync off |
| `RAGMAN_SYNC_DELAY_MS` | `20000` | the quiet period after the last save before a sync |

The footer shows the sync state right of the save badge: nothing when sync is off or nothing has synced yet, `SYNCED 12:04` (local time of the last sync), `PUSHING`, `PUSH FAILED · RETRY` (no network or push rejected; the local commit stays and the next save or Retry tries again), `CONFLICT · PULL BY HAND · RETRY` (the rebase was aborted, or a save made during the sync clashed with the pulled changes and the file was put back to that save; no automatic sync runs until you pull by hand and press Retry or restart the server). The page reads the file once when it loads: reload it after a pull brings changes from the other machine, or the next save writes over them. `npm run shots` and `npm test` run with sync off; the `footer-sync` shots set the sync states on the store and fail if the footer is wider than the page.

Data helpers, run from this folder with `python -I`:

- `scripts/link-grok.py ../ragman-data` links `images/grok/<slug>.*` files to items (`images.grok`); files whose name is not the slug are listed in the script by hand.
- `scripts/icon-fit.py <slug> <image> --footprint WxH --data ../ragman-data` cuts the background, fits the art to the footprint canvas and sets `images.icon`; see `docs/icons.md`.
- `scripts/worn-fit.py --install-base <image> --data ../ragman-data` cuts and fits Grok's base figure to `images/avatar/base.png`; see `docs/avatar.md`.
- `scripts/worn-fit.py <slug> [<slug2> ...] <image> --data ../ragman-data` keeps only what differs from the base figure, saves `images/worn/<slug>.png` and sets `images.worn` on each slug; see `docs/avatar.md`.

See `docs/DESIGN.md` for the look ("Departures") and `docs/ARCHITECTURE.md` for the engine rules, slot rules, sort modes and the EFT inventory fields.

## License and affiliation

Ragman is licensed under the GNU Affero General Public License v3.0; see `LICENSE`. The author holds the copyright and may offer other licenses separately. Outside code contributions are not accepted yet; see `CONTRIBUTING.md`.

Ragman is a fan-made personal tool inspired by the inventory screen of Escape from Tarkov. It is not affiliated with, endorsed by, or connected to Battlestate Games, and it contains none of the game's assets, icons, fonts or artwork.

## Principles

- Nothing is guessed. A value with no source stays blank.
- No prices, no buying decisions.
- Status describes use, never purchase.
- Snappy like a video game. No interaction waits on the network.
- Layout very close to EFT, slightly brighter palette.
