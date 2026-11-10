# Local development

How to install, run, and test this repo. The commands below were run on Node.js v22.23.4 (the Pages workflow installs Node 22) and npm 10.9.9. `package.json` does not pin an engine.

The private inventory is not in this repo. `vite.config.ts` and `scripts/serve.mjs` read `RAGMAN_DATA`, or `../ragman-data` when that variable is unset. That folder is a checkout of the private `ragman-data` repo. CI does not have it. The public demo uses `data/demo/` instead.

## Install

```
npm ci
```

## Public demo

Bundles `data/demo/inventory.json`. Nothing is written back to disk. Edits reset on reload.

```
npm run build:public
npm run preview -- --base /ragman/
```

Open http://localhost:4173/ragman/ . `/` redirects there.

The base flag matches `vite build --base=/ragman/` in the `build:public` script. Without it, `vite preview` serves assets at `/assets/` while the built HTML loads `/ragman/assets/...`.

## Dev server with a data folder

Private clone beside this repo:

```
npm run dev
```

http://localhost:5173/

There is no clone in a fresh checkout of this repo. `npm run dev` still listens on port 5173, the log says sync is off ("not a git repo"), and `GET /data/inventory.json` is 404 `not found`. `src/ui/app/App.tsx` renders the banner "Inventory file not found ·" and a Choose folder button for that state.

To exercise the dev server against the committed demo inventory, copy it to the gitignored `data/private/` directory and turn sync off:

```
mkdir -p data/private
cp data/demo/inventory.json data/private/
RAGMAN_DATA=data/private RAGMAN_SYNC=0 npm run dev
```

`GET /data/inventory.json` then returns that file. A PUT of `/data/inventory.json` writes that folder (`vite.config.ts`). With `RAGMAN_SYNC=0`, `GET /data/sync` reports `state` `off` and message `RAGMAN_SYNC=0`. No save was sent during the check, so `data/private/inventory.json` stayed a copy of the demo file.

http://localhost:5173/?gallery is the design-system gallery (`src/main.tsx`). It does not need inventory data.

Production build of the private mode, same data folder:

```
npm run build
RAGMAN_DATA=data/private RAGMAN_SYNC=0 npm run serve
```

http://localhost:4173/ . The server log line names the data directory. Default port is 4173 (`PORT` or the first argument overrides it).

Do not point `RAGMAN_DATA` at this repo's root. If that directory is the top of a git repo with an upstream, and sync is left on, the server commits, rebases, and pushes. `data/private` is not the top of this repo, so sync would stay off even without `RAGMAN_SYNC=0`. Set `RAGMAN_SYNC=0` anyway when the folder is only a local copy.

| Env var | Default | Effect |
| --- | --- | --- |
| `RAGMAN_DATA` | `../ragman-data` | data folder for the dev server and `scripts/serve.mjs` |
| `RAGMAN_SYNC` | on | `0` turns git sync off |
| `RAGMAN_SYNC_DELAY_MS` | `20000` | quiet period after the last save |

Sync details: `docs/ARCHITECTURE.md`.

## Tests

```
npm run typecheck
npm test
```

`npm run typecheck` is `tsc --noEmit`. `npm test` is `vitest run`.

Without the private inventory, `src/model/realdata.test.ts` skips (it honors `RAGMAN_DATA`). `src/model/demo.test.ts` still checks the demo file, and skips only the comparison against `../ragman-data/inventory.json`. That comparison does not read `RAGMAN_DATA`.

`npm test` loads `vite.config.ts`, which starts the data sync helper. Under Vitest the helper stays off (`VITEST` is set). The suite does not commit or push.

## CI

Workflow file: `.github/workflows/pages.yml`, name "Publish the public demo".

- On: `push` to `main`, and `workflow_dispatch`. Not on pull requests.
- Build: `actions/checkout@v4`, `actions/setup-node@v4` with Node 22 and `cache: npm`, then `npm ci`, `npm run typecheck`, `npm test`, `npm run build:public`, `actions/upload-pages-artifact@v3` of `dist`.
- Deploy: `actions/deploy-pages@v4` to the `github-pages` environment.

The site named in the workflow is https://logos52.github.io/ragman/ . A merge to `main` runs this workflow and publishes the built app. These docs are not the published site.

No workflow runs a linter. This repo has no `lint` script, no ESLint or Prettier config, and no lint-kit config.

## Not run here

`npm run shots` loads Playwright from `PW_DIR` or from a path outside this repo. Playwright is not in `package.json`. The script exits before taking screenshots when that install is missing. It is written to save 1440×900 and 390×844 PNGs and `refs/proof/perf.json`. `refs/` is gitignored.

The Python tools (`scripts/link-grok.py`, `icon-fit.py`, `worn-fit.py`, `check-items.py`, `make-demo.py`, `import_export.py`) target a `ragman-data` directory. Their docstrings show `python -I`. On a machine with only `python3`, Pillow and `jsonschema` still have to be installed before `worn-fit.py` or `check-items.py` will start. They were not run against data here. `docs/icons.md`, `docs/avatar.md`, and `data/demo/README.md` describe the ones that have a write-up.
