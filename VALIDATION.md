# SqueekPulse Nexus validation

Recorded on 2026-11-04 against the final `src/` and rebuilt `dist/`.

**Completion: complete for the repository implementation scope, with external/platform limitations below.** This is the worker's local check record, not independent certification of live behavior.

## Scope and requirement coverage

The existing console and dependency-free build were retained. The overlay now contains a perspective-projected 3D sphere, a semantic live HUD, and ten independent animated paths when all five panels and five settlement cards are present. No deployment, wallet integration or hosting action is part of this change.

| Requirement | Result and evidence |
| --- | --- |
| Interactive emerald-and-gold 3D globe in `?overlay=1` | Met: 960 particles, rotating wire mesh, tilted orbit, pointer/keyboard rotation, zoom and reset; inspected at desktop and phone widths |
| Block height, Round ID and next-block progress HUD/ring | Met: derives from the existing core response; responds to refreshed values; unknown/error/paused states tested |
| Tethers to mint, supply, telemetry, events, wheel and five cards | Met: ten distinct anchors with three glowing packets per connection; checked on the 1920 screenshot and in integration assertions |
| Responsive usable website and primary action on the first 390px screen | Met: sphere and 44px controls are visible; original console copy/open actions also remain on its first screen |
| Source, lockfile, `dist/index.html` and local relative assets | Met: all 12 production files match source byte-for-byte; existing lockfile retained; static subpath loading has no local failures |
| Production build, typecheck and meaningful interaction validation | Passed: commands and boundaries below |
| Better Interface six-domain review and fixes | Completed within the changed surfaces; coverage and findings below |
| Title, favicon, description, `og:title`, `og:image` | Present; share checks pass in both modes; existing SVG share-image compatibility is not certified |
| Root `DESIGN.md` and install/preview/rebuild README | Updated to describe the final implementation and actual results |

Assumptions: Round ID means `core.settledThroughRound`, matching the existing console. “Live” means the established 15-second polling cycle, not a push stream. Packet animation visualizes connectivity; its frequency does not claim transaction throughput. Existing panel URL selections are honored. Missing/empty settlements do not create invented cards or paths.

## Executed checks

| Command / check | Actual result |
| --- | --- |
| `npm run build` | Exit 0; rebuilt 12 production files |
| `npm run typecheck` | Exit 0; JSDoc/JavaScript checked by the existing TypeScript 5 command |
| `npm test` | Exit 0; 16 tests passed, 0 failed |
| `npm run check:dist` | Exit 0; `dist matches src (12 files)` |
| `node tests/browser-nexus.mjs` with an installed Playwright module | Exit 0; 13 integration groups passed; Chromium used; optional WebKit unavailable |
| Supplied `taste.mjs --out test/scratch/taste` on the production console | Exit 0; 16/16 checks passed |
| Same unmodified probe against the preview URL with `?overlay=1&lang=en` | Exit 0; 16/16 checks passed |
| `git diff --check` | Exit 0; no whitespace errors |
| Diff check of protected package/build/dependency paths | Exit 0; no changes |
| `git check-ignore -v dist/index.html dist/assets/nexus.js` | No output; export files are eligible for inclusion |

The supplied probe ran from the repository root with its declared Playwright runtime. A bounded foreground wrapper served the overlay URL and closed its preview afterwards. The managed browser tool did not launch; direct Playwright supplied the actual rendered/interaction evidence. No new browser or frontend dependency was installed.

The inherited `npm test` directory argument initially failed on Node 22. Adding `tests/index.js` lets that existing command execute both suites; no package script or lockfile was changed. Geometry tests check radius preservation, perspective, finite curves, exact panel endpoints and five distinct settlement routes, in addition to the 12 original helper/translation tests.

### Browser interaction coverage

The browser suite serves the finished export under `/preview/`, intercepting API calls with a trimmed public response capture in `tests/fixtures/telemetry.json`. It also injects intentional fault and value changes. Nothing in `src/` or `dist/` imports this fixture.

The 13 passing groups cover:

1. API-derived HUD values and ten distinct connections, with only five settlement cards visible.
2. Changing Canvas pixels during animation and identical pixels after pause, covering both particles and packets.
3. Actual mouse drag, arrow-key rotation, +/− zoom, Home reset, tab order, focus styling and bounded/disabled zoom controls. Modified browser shortcuts do not change the sphere view.
4. HUD changes while motion stays paused; HTTP 503, Retry now, unavailable data, paused core, malformed response and recovery.
5. Replacing six settlements with two and restoring them: path count changes from ten to seven and back, without orphan paths.
6. No horizontal overflow at 320×812, 390×844, 1024×768, 1100×700, 1440×900 and 1920×1080. The 390px motion action stays within the viewport and all four sphere buttons are at least 44×44px.
7. Reduced-motion emulation freezes automatic Canvas pixels; the disabled motion toggle is labelled, while explicit keyboard exploration remains usable.
8. Partial and empty panel selections exclude hidden anchors and retain telemetry.
9. 64-bit height and round values wrap without horizontal clipping; excessive progress is bounded to 100%.
10. All eight language variants retain localized names, HUD values, no horizontal overflow and a first-screen motion action at 390px.
11. Normal console regression: return navigation, language, mint/wheel ranges, event category/pause, panel selection, clipboard content and copy confirmation.
12. A deliberately unavailable Nexus Canvas context leaves its semantic HUD readable and disables renderer controls.
13. Zero uncaught JavaScript errors and zero missing local export assets.

### Rendered evidence and probe qualifications

Screenshots were generated and viewed for the desktop composition, the 390px sphere, visible keyboard focus, the normal console first screen and the compact desktop layout. Browser evidence is under `test/scratch/nexus-validation/`, including `overlay-1920.png`, `overlay-390.png`, `overlay-390-focus.png`, `console-390.png`, translated/long-value states and `results.json`. Probe screenshots/results are under `test/scratch/taste/`, with mode-specific results copied to `test/scratch/taste-console.json` and `test/scratch/taste-overlay.json`. Scratch evidence is transient and is not part of the static export; the checked-in browser suite reproduces it.

Both probes report no horizontal scrolling, text overlap, floating controls covering text, hidden-overflow text clipping, repeated error paragraphs, missing metadata, or reduced-motion CSS animation. They report two font families and two weights. The ordinary console uses five sizes; the measured overlay error state uses four. First-screen prose is 38 words for the 390px console and 29 for the overlay, within the probe's 60-word bar.

Direct browser transport to the API failed in this run, so the probe's API-dependent sections were in their error state. Successful-data geometry and controls were checked separately with public captured responses. The probe skips text it considers over Canvas/images: 93 overlay text boxes were unmeasured for contrast. Therefore its green contrast result is not a complete overlay contrast audit.

## Better Interface review

All six core domains and the documentation method in the pinned guide were read and applied. The existing emerald/gold direction and professional dashboard density were preserved.

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility | Checked: native named controls, keyboard equivalents, natural tab sequence, visible focus screenshot, 44px sphere controls, semantic HUD, explicit status text, reduced-motion pixel comparison and Nexus-renderer fallback | No screen-reader session, native zoom, physical touch device, or full automated accessibility audit |
| Layout | Checked: final production screenshots and bounds at six widths, all eight locales at 390, long integers, dynamic card count, hidden panels and static subpath | No physical OBS capture; compact side panels intentionally scroll internally; no claim about every possible viewport |
| Writing | Checked: verb-first controls, adjacent manipulation instructions, consistent telemetry terms, named recoverable errors, explicit unknown/delayed values and a plain statement that paths visualize feeds | Translations have structural/functional tests but no native-speaker review |
| Typography | Checked: existing five-step scale, two families/weights, tabular numbers, wrapped long values, readable heading hierarchy and first-screen composition | System font fallback varies by platform; broadcast scaling yields small captions at compact desktop widths |
| Colors | Checked: existing role tokens and neutral backplates; exact CSS-pair calculations below, plus probe's measured pairs | Probe skips Canvas-backed text; arbitrary footage and pre-existing bare status labels are not fully contrast-certified |
| UI | Checked: actual drag/zoom/reset, button/focus/disabled/paused states, flowing paths, exact Canvas freeze, named transitions, renderer layer below panels, and endpoint changes after resize/data replacement | No 10%-speed animation-panel session or hardware performance benchmark; WebKit unavailable |

Contrast calculation: `rgba(6,16,13,0.94)` composited over white gives RGB `(20.94,30.34,27.52)`. Against that stated backplate, primary `#e9f6ef` is 15.27:1, muted `#a6bbb0` 8.37:1, emerald `#5dfba0` 12.75:1, gold `#ffd257` 11.81:1 and warning `#ffb86b` 9.96:1. Button text `#04140c` against `#39e58c` is 11.49:1. These are computed identified CSS pairs, not invented whole-screen measurements.

### Findings fixed and rechecked

| Severity | Final source | Finding / change | Recheck |
| --- | --- | --- | --- |
| High | `src/assets/nexus.css:105` | The existing fixed three-column overlay could not serve a phone. Added scrolling two-/one-column compositions, with sphere and controls first. | Overflow assertions at 320/390 and first-screen screenshots; all eight locales |
| Medium | `src/assets/nexus.js:134`, `src/assets/nexus.css:93` | Initial mobile curves crowded the instruction/control area. Routed paths through outer gutters and added local backplates, including an opaque paused action. | Final 390 screenshot and focus state visually inspected |
| Medium | `src/assets/nexus.css:3`, `src/assets/nexus.css:85` | Transparent instrument labels needed a known reading surface over footage. Reused the overlay-surface token with 94% opacity for HUD, heading and help. | Identified pair contrast calculation and final screenshots; video limitations retained |
| Medium | `src/assets/nexus.js:74` | After a cached paused-core response, a malformed refresh left the status saying only “Core paused.” Stale telemetry now takes precedence. | Fault-injection sequence now passes and preserves known values |
| Medium | `src/assets/app.js:286`, `src/assets/i18n.js:114` | The probe found the same generic error across sections; shared settlement data also labelled a mint failure as settled blocks. Errors now name the affected panel, in all eight locales. | Both final probes: repetition passes; retry/recovery and translation tests pass |
| Medium | `src/assets/nexus.js:327`, `src/assets/nexus.css:78` | The initial sphere handlers could consume modified browser zoom/navigation keys. Modifier shortcuts and Ctrl+wheel now pass through; the touch surface permits pinch zoom. | Modifier-key regression assertions pass; native zoom/physical pinch remain unverified |

## Remaining limitations

- Direct Chromium requests to all five public API paths returned `net::ERR_EMPTY_RESPONSE`. Separate public HTTPS requests via curl succeeded; `/v1/core` returned HTTP 200, JSON and `Access-Control-Allow-Origin: *`. This establishes reachable public data and declared CORS, not a successful direct live browser session. The production app retains its actual public API URLs and normal retry behavior, with no mock-data fallback.
- WebKit was attempted and unavailable. No Safari/iOS, physical device, screen reader, native 200% zoom or OBS session is claimed. Browser Canvas transparency/layout is checked; compatibility with a particular OBS build is not certified.
- The sphere's frame rate is capped at 30 and backing resolution at eight million pixels. These are implementation bounds, not a promise of measured 30fps on all hardware.
- The existing heatmap still has pointer-based per-slot exploration; its summary is accessible, but a keyboard values table was outside this overlay change. The existing API client checks a numeric schema version; future schema compatibility is not certified.
- Existing SVG social-card support varies by unfurler; metadata and local asset presence pass, but social platform rendering was not tested.
- All limits above are recorded without substituting invented live readings or claiming the structural verifier certifies behavior.

## Submission integrity and size

The repository candidate (tracked files plus eligible new files, excluding task inputs and scratch) is below **0.5 MiB**, against the **8 MiB** limit. The required production export is **177,899 bytes**. A workspace-only file audit found no dependency directories, package archives, registry mirrors or new submodules in that candidate. All required export assets are eligible for Git inclusion; ignore files and protected build/package/dependency files were unchanged. The network worker performs the eventual commit/upload.
