# Ragman

An EFT inspired inventory management system.

Ragman is a personal catalog of everything you own, laid out like the Escape from Tarkov inventory screen: the person with equipped slots on the left, carried containers in the middle, the Stash grid on the right. It exists to give a bird's-eye view of every item so nothing is wasted or bought twice, and to make packing for a trip feel like building a loadout.

Named after the Tarkov trader who sells clothing and gear. On screen the app is called "Inventory".

## Layout of this repo

| Path | Holds |
| --- | --- |
| `schema/inventory.schema.json` | the formal schema for `inventory.json` |
| `data/demo/` | demo data for the public build, pre-approved items only |
| `docs/` | architecture and design notes. The PRDs are in a private repo. Local setup is `docs/DEVELOPMENT.md` |
| `src/` | the app: `model/` (types, store contract, engine, persistence), `ui/` (screens, drag, menus, windows), `styles/` (tokens, fonts) |
| `scripts/` | `serve.mjs` (production server), `sync.mjs` (git sync), `shots.mjs` (Playwright proof), and the Python data tools |
| `refs/` | local screenshots and references, gitignored |

The real inventory lives in the private `ragman-data` repo and is never committed here. This repo does not contain that clone. The dev server and `scripts/serve.mjs` read a data folder: `RAGMAN_DATA`, or `../ragman-data` when that variable is unset.

## Prerequisites

- Node.js 22. The Pages workflow (`.github/workflows/pages.yml`) installs Node 22. `package.json` has no `engines` field.
- npm. The lockfile is `package-lock.json`, and CI installs with `npm ci`.

Python is only for the data tools under `scripts/`. It is not required to install, run, or test the app. See [Data tools](#data-tools).

## Install

From this repo:

```
npm ci
```

## Run the public demo

This is the build CI publishes. It bundles `data/demo/inventory.json`. Edits stay in memory and reset on reload (`VITE_BUILD=public` in `src/model/persist.ts`). No private data clone is required.

```
npm run build:public
npm run preview -- --base /ragman/
```

Open http://localhost:4173/ragman/ . The server redirects `/` to that path.

`build:public` sets Vite's base to `/ragman/` (`package.json`). `npm run preview` on its own uses base `/`, so the HTML requests `/ragman/assets/...` and the script does not load. Pass `--base /ragman/`.

While the dev server is running, http://localhost:5173/?gallery shows the design-system gallery (`src/main.tsx`).

## Run against a data folder

`npm run dev` and `npm run serve` serve `inventory.json` and `images/*` from the data folder at `/data/*`, and they write saves back to that folder.

With the private `ragman-data` checkout beside this repo, the default path is enough:

```
npm run dev
```

http://localhost:5173/

The production build of that same mode:

```
npm run build
npm run serve
```

http://localhost:4173/ . `scripts/serve.mjs` listens on `PORT`, or the port argument, or 4173. Without `../ragman-data`, that server still starts, sync stays off ("not a git repo"), and `GET /data/inventory.json` is 404.

If `../ragman-data` is not there, `npm run dev` still starts, and `GET /data/inventory.json` answers 404 with the body `not found`. `src/ui/app/App.tsx` renders a banner, "Inventory file not found ·", and a Choose folder button when the store has an error and no inventory. Choosing a folder uses the File System Access API. `src/model/persist.ts` tells other browsers to use Chrome or Edge.

To run and save against the committed demo file without editing `data/demo/`, copy it into `data/private/` (gitignored) and point `RAGMAN_DATA` at that directory. `RAGMAN_SYNC=0` keeps the server from committing or pushing:

```
mkdir -p data/private
cp data/demo/inventory.json data/private/
RAGMAN_DATA=data/private RAGMAN_SYNC=0 npm run dev
```

The same variables work with the production server, after `npm run build`:

```
RAGMAN_DATA=data/private RAGMAN_SYNC=0 npm run serve
```

Both servers refuse any `/data` path containing `prices` or `..`. Only `inventory.json` and `images/*` are served. Every mutation is in memory; the file is written in the background and the footer badge shows the save state.

When the data folder is the top of a git repo with an upstream branch, and `RAGMAN_SYNC` is not `0`, both servers commit and push that repo in the background. The rules are in `docs/ARCHITECTURE.md` (Sync). `npm test` forces sync off, because Vitest sets `VITEST`. This checkout was not run against a data repo with an upstream, so the push itself was not exercised.

| Env var | Default | Effect |
| --- | --- | --- |
| `RAGMAN_DATA` | `../ragman-data` | the data folder |
| `RAGMAN_SYNC` | on | `0` turns the git sync off |
| `RAGMAN_SYNC_DELAY_MS` | `20000` | the quiet period after the last save before a sync |

The footer shows the sync state right of the save badge. The states and the "reload after a pull" rule are described in `docs/ARCHITECTURE.md`.

## Tests

Same checks the Pages workflow runs, in the same order:

```
npm run typecheck
npm test
npm run build:public
```

`npm test` is `vitest run` (`vite.config.ts`: jsdom, `src/**/*.test.{ts,tsx}` and `scripts/**/*.test.mjs`). `src/model/realdata.test.ts` reads `RAGMAN_DATA` or `../ragman-data` and skips when `inventory.json` is absent. `src/model/demo.test.ts` always checks that `data/demo/inventory.json` loads, and skips the "no string from the private file" check unless `../ragman-data/inventory.json` is beside this repo (that path does not follow `RAGMAN_DATA`).

## CI

`.github/workflows/pages.yml` ("Publish the public demo") runs on every push to `main`, and from `workflow_dispatch`. It does not run on pull requests.

The build job checks out the repo, installs Node 22 with an npm cache, then runs `npm ci`, `npm run typecheck`, `npm test`, and `npm run build:public`. It uploads `dist` as a Pages artifact. The deploy job publishes that artifact with `actions/deploy-pages`. The workflow comment names the site: https://logos52.github.io/ragman/

A push to `main`, including a merge, rebuilds and deploys that site. The markdown in this repo is not what the site serves.

There is no lint script and no lint-kit config in this repo. The workflow does not run a linter.

## Data tools

These scripts edit a `ragman-data` folder. Their usage lines are at the top of each file. They did not complete here: this machine has `python3` and no `python` on `PATH`, Pillow and `jsonschema` are not installed, and the private data clone is not present.

- `scripts/link-grok.py` sets `images.grok` from `images/grok/`.
- `scripts/icon-fit.py` fits an icon and sets `images.icon`. See `docs/icons.md`.
- `scripts/worn-fit.py` fits the base figure and worn layers. See `docs/avatar.md`. It also has a `--selftest` that needs Pillow.
- `scripts/check-items.py` checks a vendor or inbox batch against the schema. It exits if `jsonschema` is missing.
- `scripts/make-demo.py` regenerates `data/demo/inventory.json` from a private inventory. See `data/demo/README.md`.
- `scripts/import_export.py` imports an older export into a data folder.

`npm run shots` (`scripts/shots.mjs`) is written to save Playwright screenshots at 1440×900 and 390×844 into `refs/proof/`, plus `refs/proof/perf.json`. Playwright is not a dependency of this repo. The script loads it from `PW_DIR`, or from a directory outside this repo. Running it here exited immediately because that module was not found.

## Design notes

A sun and moon button in the tab bar switches dark mode; the choice is kept per browser.

See `docs/DESIGN.md` for the look ("Departures", and its dark set) and `docs/ARCHITECTURE.md` for the engine rules, slot rules, sort modes and the EFT inventory fields.

## License and affiliation

Ragman is licensed under the GNU Affero General Public License v3.0; see `LICENSE`. The author holds the copyright and may offer other licenses separately. Outside code contributions are not accepted yet; see `CONTRIBUTING.md`.

Ragman is a fan-made personal tool inspired by the inventory screen of Escape from Tarkov. It is not affiliated with, endorsed by, or connected to Battlestate Games, and it contains none of the game's assets, icons, fonts or artwork.

## Principles

- Nothing is guessed. A value with no source stays blank.
- No prices, no buying decisions.
- Status describes use, never purchase.
- Snappy like a video game. No interaction waits on the network.
- Layout very close to EFT, slightly brighter palette.
