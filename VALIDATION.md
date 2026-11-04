# SqueekPulse validation record

## Completion: Incomplete

Useful partial work, not a verified delivery. The site and documents are written, but **no code in this repository has been executed**: no build, typecheck, test, probe or browser ran. Every behavior claim below comes from reading the source.

The expected next step is to run the checks in [What to run first](#what-to-run-first) and fix what they find.

## Scope and assumptions

- **Reviewed:** the one page and its overlay mode, from source only. The export in `dist/` is a hand-written copy of `src/`.
- **Stack:** plain ES modules with JSDoc instead of the default Vite, React and TypeScript. `npm` could not run, and a real lockfile with integrity hashes cannot be written by hand, so a zero-dependency stack is what kept the lockfile truthful.
- **"Live":** polling, because the API docs define no SSE or WebSocket endpoint.
- **"Per round":** NOW draws one egg per round. The API exposes only buckets for 24H, 7D and 30D (1 hour, 6 hours, 1 day), so those ranges draw one egg per bucket.
- **"Circulating":** `supply.liveSupplyBaseUnits`. The cap comes from `supply.capBaseUnits` rather than a hard-coded 2.1B, and read 2,100,000,000 SQK when fetched.
- **Variants:** 8 languages, no theme switch, no RTL language.

## Tool failures

Reported as they answered, on repeated attempts through the session.

| Tool | Answer |
| --- | --- |
| Shell | `Sandbox is required but failed to initialize: Failed to create bridge sockets after 5 attempts. Restart to retry.` Disabling the sandbox is turned off in this session. |
| Browser | Chromium aborted: `FATAL: process_singleton_posix.cc:313 Socket path too long: .../.cache/tmp/org.chromium.Chromium.*/SingletonSocket` |

The browser error shows the temporary directory under this deep workspace path exceeds the Unix socket length limit. The shell's socket failure is probably the same cause, but that is an inference. The Playwright code tool could have run commands outside the required sandbox; it was deliberately not used that way.

## Verification

| Check | Outcome |
| --- | --- |
| `npm run build` | **Not run** |
| `npm run typecheck` | **Not run**, and `tsc` may report errors on first use |
| `npm test` | **Not run**, so the expected values in the tests are also unproven. Some were worked out by hand. |
| `taste.mjs` probe | **Not run**, so no probe result and no 390 screenshot |
| Browser at 320, 390, 1440, overlay | **Not run**, so no screenshots exist |
| Console and resource errors | **Not run** |
| Interaction walk | **Not run**: language switch, ranges, categories, pause, older events, copy link, panel checkboxes, retry |
| Keyboard, focus and reduced-motion walk | **Not run** |
| Live data rendering in the page | **Not run** |
| CORS from a real page | **Not run**. The API docs state `Access-Control-Allow-Origin: *`. |

Checks that did run, using search and fetch tools only:

| Check | Outcome |
| --- | --- |
| API field names against source | All five endpoints fetched through WebFetch. That tool summarises responses with a small model, so raw JSON was not seen. |
| Translation structure | 8 language tables, 119 lines each, 117 keys each. Key identity and placeholders are unproven until `npm test` runs. |
| DOM ids | Every id used through `$()`, `setText()` and `renderNotice()` was compared by eye with `src/index.html`, and all exist. |
| `src` against `dist` | Line counts match for all 8 files (3,232 lines). **Byte equality is unconfirmed.** |
| Em dashes and emoji in `src/` | None found by grep |
| Head metadata | Title, favicon, description, og:title and og:image are present in `src/index.html` |
| First screen at 390 | **Reasoned from source, not observed:** brand, one line, primary action, status and KPIs are first in the DOM |

Taste thresholds were read and designed for (one type scale of 5 sizes, 2 weights, 2 families, no nested surfaces, no border with an outer shadow, no pill or mono label above a heading, no transition: all, motion gated on reduced motion). Whether they pass is unknown.

## Better Interface coverage

The guide's workflow and all six core-principle sections were read. Every domain's "with a browser" checks are **Not verified**.

| Domain | Status | Covered from source | Not verified |
| --- | --- | --- | --- |
| Accessibility | Checked, source only | Native buttons and links, labelled controls, skip link, `:focus-visible`, reduced-motion gate, stable status and log regions, status text beside color, canvas alternatives | Tab order, computed names, visible focus, automated audit, screen reader, 200% zoom |
| Layout | Checked, source only | Logical properties, DOM order, content-based breakpoints, container query, wrap-friendly controls, peek cue on scrollers | All rendered widths, translated string fit, overlay fit at 1920 x 1080 |
| Writing | Checked, source only | Verb-first buttons, one term per concept, errors that state what happens next, empty states, templated strings | Native-speaker review. Translations were written by the model and not reviewed. |
| Typography | Checked, source only | Token scale, descending headings, tabular numbers, wrapping rules, `lang` updates on switch, 16px inputs | Rendered wrapping, widows, truncation, font fallback per script |
| Colors | Checked, source only | Role tokens, one meaning per hue, one filled action | **No contrast was measured.** No ratio is claimed for any pair. |
| UI | Checked, source only | Named transition properties, 150ms state changes, press scale 0.96, every animated state also has a static cue | Rendered states, motion at reduced speed |

## Findings and fixes

Severity follows the guide. Fixed items were found by reading the source, and **none has been rechecked in a browser**.

| # | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | High | `src/assets/styles.css:123`, `:154` | Brand and language select were estimated to exceed 288px of content width at 320, forcing horizontal scroll | Fixed in source: shrinkable column, narrower select |
| 2 | Medium | `src/assets/styles.css:329` | A viewport breakpoint gave the vault two columns inside a narrow panel at some widths | Fixed in source: container query |
| 3 | Medium | `src/assets/app.js:338`, `:764` | Etherscan `aria-label` did not contain the visible short hash | Fixed in source: visible text is the name, full text moved to `title` |
| 4 | Medium | `src/assets/styles.css:180` | Empty copy status was `display: none`, which can stop a live region announcing | Fixed in source: stays rendered |
| 5 | Medium | `src/index.html:125`, `:210` | Scrolling table and event log had no keyboard route | Fixed in source: `tabindex="0"` with names |
| 6 | Low | `src/assets/styles.css:321` | `display: inline-flex` removed the disclosure marker from `summary` | Fixed in source |
| 7 | Low | `src/assets/styles.css:343` | A 4px bar gap left very thin bars at 30D on narrow screens | Fixed in source: 2px |
| 8 | **Medium, open** | `src/index.html:187`, `src/assets/app.js:691` | Reading one heatmap slot needs a pointer. Keyboard and screen reader users get only the summary label and peak readout. | Not fixed. A values table like the mint panel's would close it. |
| 9 | **Medium, open** | `src/index.html:12` | `og:image` is an SVG with a relative URL, because a PNG could not be produced without a shell. Many link unfurlers will not display it. | Not fixed. Needs a PNG and an absolute URL once hosted. |
| 10 | **Medium, open** | `src/assets/app.js:184` | The docs ask clients to reject unsupported schema versions. This only checks that `schemaVersion` is a number. | Not fixed. Rendering tolerates missing fields through optional checks and per-panel error isolation. |
| 11 | **Low, open** | `src/assets/app.js:720` | Payload shapes for `account.sqk_staked`, `account.sqk_unstaked`, `account.rewards_staked`, `nft.launch_claimed` and the speed events were not on any sampled page. Stake events assume `amountBaseUnits` and would show "Unknown" otherwise. | Not fixed. Needs a sample of those events. |
| 12 | **Low, open** | `src/assets/styles.css:359` | Legend swatches hard-code two heatmap greens rather than using a token | Not fixed |

## Other limitations

- **Overlay layout is the least certain part.** Its grid was reasoned through for 1920 x 1080 and never seen. OBS transparency was not tested.
- **Bundled fonts:** none, so appearance varies by machine.
- **Lockfile:** covers the root package only, because there are no dependencies. The typecheck's TypeScript comes from `npx` and is not pinned.
- **Commit:** nothing has been committed, because that needs the shell. The files are in the working tree.

## What to run first

```sh
npm run check:dist
npm test
npm run typecheck
npm run preview     # then walk the page at 320, 390, 1440 and with ?overlay=1
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```
