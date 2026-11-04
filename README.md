# SqueekPulse

Live Squeekchain telemetry on Sepolia, in EN, ZH, VI, KO, RU, TR, ES and ID. The normal console includes settlement mosaics, SQK mint and supply panels, wheel distance/activity charts, and an event stream. All data comes from `https://api.squeekchain.com/v1`; the site has no backend or wallet.

Overlay mode (`?overlay=1`) now includes the **Squeekchain Nexus Sphere**: a rotating emerald-and-gold 3D particle/wireframe globe, a live progress ring and HUD, and glowing Bézier tethers to the two SQK panels, telemetry, events, wheel, and each of the five visible settlement cards.

## Install, rebuild and preview

Use Node 20 or newer. This existing project uses native JavaScript ES modules, JSDoc checking and a copy build. There are no runtime/build dependencies. Its existing package manifest and lockfile are preserved; `npm ci` is optional for the empty dependency set.

```sh
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/preview/` for the console or `http://127.0.0.1:4173/preview/?overlay=1` for the sphere. Use a web server: ES modules do not work reliably through `file://`.

Edit `src/` and rebuild. The build recreates the complete `dist/`, including `dist/index.html` and local assets. Asset URLs are relative and the preview deliberately serves a subpath. Publish the contents of `dist/` as a static site. No server rewrites or compilation on the host are needed.

## Use the overlay

Copy the overlay link from the console and add it as an OBS Browser source, preferably at **1920 × 1080**. The page background remains transparent, with dark backplates behind text. Use OBS's Interact window to operate the sphere controls.

| Control | Action |
| --- | --- |
| Drag the sphere | Rotate its 3D view |
| Arrow keys while the sphere is focused | Rotate without a pointer |
| `+`, `−` buttons or `+`, `-` keys | Zoom between 75% and 120% |
| Mouse wheel over the desktop sphere | Zoom; mobile retains vertical scrolling |
| Reset view / `Home` | Restore the camera without changing data |
| Pause motion / `Space` | Freeze rotation and packets; live telemetry still refreshes |
| Back to console | Return to the regular page, preserving the language |

The operating system's reduced-motion setting freezes automatic sphere and packet motion. Explicit rotation/zoom still works. Below 1100px wide, or below 700px tall, the overlay becomes a readable scrolling layout. Below 600px it uses one column, with the sphere and controls first.

| URL parameter | Values |
| --- | --- |
| `overlay=1` | Enable the transparent overlay and Nexus Sphere |
| `lang` | `en`, `zh`, `vi`, `ko`, `ru`, `tr`, `es`, `id` |
| `panels` | Comma-separated `blocks,mint,supply,wheel,events`; omitted shows all; empty hides these panels |
| `wheel` | `7d` or `30d` |

Telemetry remains visible even when optional panels are hidden. Tethers attach only to panels and cards that exist. No settlement cards are invented while data is loading or unavailable.

## Data and rendering

- HUD Block height = `core.blockHeight`; Round ID = `core.settledThroughRound` (the settled round). Next block = `core.blockProgress / configuration.blockUnitsPerBlock`, bounded to 0–100% and displayed to one decimal place.
- Core, settlements, supply and events poll every 15 seconds. Mint ranges poll every 60 seconds; wheel statistics every 10 minutes. Existing retry/backoff and hidden-tab behavior are retained.
- Errors preserve known HUD values and mark them delayed. Unavailable or missing values display `-`. The HUD never extrapolates chain progress between responses.
- Continuous packets illustrate the connections, as stated beside the controls. Their speed/count is not a transaction or throughput measurement. They dim when core telemetry is unavailable, delayed or paused.
- The renderer projects real 3D coordinates onto a transparent Canvas 2D surface: perspective, depth sorting, a wire mesh and 960 particles. It requires no WebGL, models, textures or new packages. Drawing is capped at 30 frames per second and eight million backing pixels.

## Checks

```sh
npm test
npm run typecheck
npm run check:dist
```

Typecheck uses the existing package command, which downloads TypeScript 5 through `npx`. It is not pinned by the dependency-free lockfile.

For the browser integration suite, use an existing Playwright installation and its Chromium browser:

```sh
IMD_PLAYWRIGHT=/path/to/playwright/index.mjs node tests/browser-nexus.mjs
```

This starts and closes its own static preview, intercepts API requests with a trimmed public capture in `tests/fixtures/telemetry.json`, injects test failures, and saves screenshots/results under `test/scratch/nexus-validation/`. Fixtures are never copied to `dist/`. WebKit is attempted when installed; an unavailable runtime is reported as a limitation.

Results recorded on 2026-11-04: production build, typecheck and export comparison passed; all **16 unit tests**, **13 browser check groups**, and **16/16 visual-probe checks in each mode** passed. The 390px first screen was inspected; responsive checks covered widths from 320 to 1920.

Direct Chromium API requests returned `ERR_EMPTY_RESPONSE` in this validation run. Public HTTPS requests through curl returned HTTP 200 and `Access-Control-Allow-Origin: *`. Data rendering and recovery were tested with captured responses, not claimed as a successful end-to-end live browser connection. Safari, physical devices and OBS itself were not tested. See [VALIDATION.md](VALIDATION.md) for coverage, fixes and remaining limitations, and [DESIGN.md](DESIGN.md) for the implemented design system.

## Files and credits

`src/assets/nexus.js` owns rendering, input and HUD synchronization; `nexus-math.js` owns pure geometry; `nexus.css` extends overlay layout; `nexus-i18n.js` supplies all eight locales. The normal console remains in `app.js`, `draw.js`, `logic.js` and `styles.css`.

Testnet SQK has no monetary value. Design review uses Jakub Krehel's Better Interface (MIT, copyright 2026 Jakub Krehel); documentation follows the method from Paul Bakaus's Impeccable (Apache-2.0, copyright 2025 Paul Bakaus), as pinned for this assignment. No runtime code from those guides is distributed.
