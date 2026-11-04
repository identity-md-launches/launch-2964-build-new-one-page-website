# SqueekPulse

A one-page, 8-language (EN, ZH, VI, KO, RU, TR, ES, ID) cyber-glass telemetry console and OBS stream overlay for Squeekchain on Sepolia. It reads the public API at `https://api.squeekchain.com` from the browser. There is no backend, no wallet and no API key.

> **Verification status: incomplete.** This export has never been executed. The machine it was written on had no working shell or browser, so the build, typecheck, tests and browser checks did not run. See [Build and check results](#build-and-check-results) and [VALIDATION.md](VALIDATION.md). Run the commands below before relying on it.

## What it shows

| Panel | Source | Content |
| --- | --- | --- |
| Overview | `/v1/core` | Block height, next-block progress, settled round, work per 1,000 blocks, safe Sepolia block |
| Settled blocks | `/v1/settlements` | Green 13x24 pixel-mosaic cards with live relative timestamps and Sepolia Etherscan links |
| SQK mint tracker | `/v1/settlements?range=` | NOW, 24H, 7D, 30D, a pixel-art hen and golden dot-matrix eggs |
| SQK supply vault | `/v1/economy/state` | Circulating supply against the total cap on a dot-matrix egg canvas |
| Hamster wheel | `/v1/measurement/stats?range=` | Distance bars (7D, 30D) and a 48-slot UTC activity heatmap |
| Event stream | `/v1/events` | Live events with category filters, pause and older pages |

How the data behaves:

- **Live means polling.** The API docs define no SSE or WebSocket endpoint. Core, settlements, economy and events refresh every 15 seconds, ranged settlements every 60 seconds and stats every 10 minutes, because the docs call stats too heavy to poll. Polling pauses in a hidden tab and failed feeds back off.
- **Unknown stays unknown.** A value the API reports as unavailable, or a day with a null distance, is shown as unknown and never as zero.
- **Eggs.** NOW draws one egg per 10-minute round from `recentRounds`. The API has no per-round data in the wider ranges, so 24H, 7D and 30D draw one egg per API bucket (1 hour, 6 hours, 1 day).

## Install

Requires Node 20 or newer. The site has no runtime or build dependencies, so `package-lock.json` holds only the root package.

```sh
npm ci
```

## Preview

```sh
npm run preview
```

This serves `dist/` at `http://127.0.0.1:4173/preview/`, a subpath, so a broken relative asset URL shows up the way it would on a gateway. Set `PORT` to change the port. Use a server rather than opening the file directly, because browsers block ES modules on `file://`.

## Rebuild

The source is plain ES modules in `src/`, so the build is an exact copy to `dist/`.

```sh
npm run build        # recreate dist/ from src/
npm run check:dist   # fail if dist/ differs from src/
npm test             # node:test suite for helpers and translation completeness
npm run typecheck    # JSDoc check; downloads TypeScript 5 through npx
```

The site was meant to use Vite, React and TypeScript, but `npm` could not run on the authoring machine, and a real lockfile cannot be written by hand. A dependency-free stack made the export deliverable and keeps the lockfile accurate. TypeScript is fetched on demand and is not pinned in the lockfile.

## OBS overlay

Use **Copy OBS overlay link** on the page, then add the link as a Browser source at 1920 x 1080. Or build the URL yourself:

| Parameter | Values | Effect |
| --- | --- | --- |
| `overlay=1` | | Transparent page with no chrome or scrolling. The mint range rotates every 20 seconds. |
| `lang` | `en zh vi ko ru tr es id` | Language |
| `panels` | comma list of `blocks,mint,supply,wheel,events` | Panels to show. All of them by default. |
| `wheel` | `7d`, `30d` | Wheel range. `7d` by default. |

## Layout

```
src/index.html              page markup, head metadata
src/assets/app.js           feeds, rendering, interactions
src/assets/logic.js         pure helpers, covered by tests/
src/assets/draw.js          canvas: mosaic, hen, eggs, vault, heatmap
src/assets/i18n.js          the 8 languages
src/assets/styles.css       tokens, layout, overlay mode
dist/                       the committed static export, a copy of src/
scripts/build.mjs           build and --check
scripts/preview.mjs         local static preview
tests/logic.test.mjs        helper and translation tests
DESIGN.md                   implemented design system
VALIDATION.md               Better Interface review and check record
```

## Build and check results

Recorded on 2026-11-04. Nothing in this table passed, because nothing could be run.

| Command | Result |
| --- | --- |
| `npm ci` | **Not run.** No shell. |
| `npm run build` | **Not run.** `dist/` was written by hand to match `src/`. |
| `npm run check:dist` | **Not run.** Only line counts were compared: all 8 files match. Byte equality is unconfirmed. |
| `npm run typecheck` | **Not run.** |
| `npm test` | **Not run.** The tests have never executed. |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | **Not run.** |
| Browser walk at 320, 390, 1440 and overlay | **Not run.** Browser failed to launch. |
| Live API | **Partly checked.** Field names were read through a summarising fetch tool, not from raw responses in a browser. CORS is `*` according to the API docs, not observed. |

The shell failed on every attempt with `Sandbox is required but failed to initialize: Failed to create bridge sockets after 5 attempts. Restart to retry.` The browser failed with `Socket path too long` under the deep temporary directory.

## Credits

Testnet SQK has no monetary value. Design review follows Better Interface by Jakub Krehel (MIT) and the documentation method from Impeccable by Paul Bakaus (Apache-2.0), as pinned for this assignment.
