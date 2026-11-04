# SqueekPulse design system

Extracted from the source: tokens in `src/assets/styles.css`, canvas colors in `src/assets/draw.js`, strings in `src/assets/i18n.js`. No value below has been confirmed in a browser, because none was available when this was written (see `VALIDATION.md`).

## Overview

SqueekPulse is for Squeekchain followers and for streamers who want live chain telemetry on air. It is a dense, dark console: translucent glass panels over a faint grid with two soft glows, with data set in monospace and labels in the system sans.

Color carries meaning. Green is the chain and anything live. Gold is SQK. The eggs, the hen and the mosaics are the product's illustration language, and they are drawn from data rather than used as decoration.

The first screen holds the product name, one plain line, the primary action, the live status and the key numbers. Everything else follows in one scroll, reachable from the section links.

Two modes share one markup: the console and the transparent overlay (`html.overlay`, set before first paint by an inline script when the URL has `overlay=1`).

## Colors

One dark theme only. Tokens are in `:root` in `src/assets/styles.css`.

| Token | Value | Job |
| --- | --- | --- |
| `--color-bg` | `#07110e` | Page, and field or select backgrounds |
| `--color-surface` | `rgba(18, 38, 31, 0.62)` | Glass panels and block cards |
| `--color-surface-overlay` | `rgba(6, 16, 13, 0.82)` | The same surfaces in overlay mode, more opaque to read over video |
| `--color-line` | `rgba(140, 255, 200, 0.18)` | Panel, card and field borders |
| `--color-line-strong` | `rgba(140, 255, 200, 0.42)` | Button borders and hover borders |
| `--color-sheen` | `rgba(255, 255, 255, 0.06)` | Inset top highlight on glass |
| `--color-text` | `#e9f6ef` | Primary text |
| `--color-text-muted` | `#a6bbb0` | Labels, help text and timestamps |
| `--color-chain` | `#5dfba0` | Links, live state and pressed segment border |
| `--color-chain-solid` | `#39e58c` | The primary action fill and wheel bars |
| `--color-on-chain` | `#04140c` | Text on the primary action |
| `--color-mint` | `#ffd257` | SQK amounts and the best-day bar |
| `--color-warning` | `#ffb86b` | Errors, unavailable notices, reconnecting state and paused core |
| `--color-focus` | `#ffffff` | Focus ring |

Canvas cannot read CSS tokens, so `src/assets/draw.js` repeats its palette as constants. Change both together.

| Constant | Values | Job |
| --- | --- | --- |
| `MOSAIC_GREENS` | `#0d2a1e #14532f #1f8a4c #33c46f #6dffa6` | Mosaic levels 0 to 4 |
| `HEAT_GREENS` | `#14532f #1f8a4c #33c46f #6dffa6` | Heatmap quartiles of observed work |
| `HEAT_ZERO` | `#16302a` | A slot observed with zero work, which is different from no data |
| `GOLD`, `GOLD_DIM` | `#ffd257`, `rgba(255, 210, 87, 0.2)` | Lit and unlit egg dots |
| `HEN_COLORS` | six fixed colors | The hen sprite |

The legend swatches in `styles.css` (`.swatch-low`, `.swatch-high`) hard-code the first and last heatmap greens. Contrast has not been measured; see `VALIDATION.md`.

## Typography

No web fonts are bundled, so CJK, Hangul, Cyrillic and Vietnamese text comes from each machine's system fonts.

- `--font-sans`: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", "Malgun Gothic", sans-serif`. Prose, labels, headings and controls.
- `--font-mono`: `ui-monospace, "SF Mono", "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace`. Numbers, hashes and readouts. Never prose.

Five sizes, in `rem` so overlay mode can scale them by changing the root size:

| Token | Size | Use |
| --- | --- | --- |
| `--text-xs` | 0.75rem | Stat labels, card details, chart axes |
| `--text-sm` | 0.875rem | Help text, buttons, event text |
| `--text-md` | 1rem | Body, `h3`, secondary values, inputs (16px avoids iOS input zoom) |
| `--text-lg` | 1.25rem | `h1`, `h2` |
| `--text-xl` | 1.75rem | Headline values (`.value-xl`) |

Weights are 400 and 600. Line height is 1.5 on the body and 1.1 to 1.25 on headings. Changing numbers use `tabular-nums`. Headings use `text-wrap: balance` and help text uses `pretty` with a 70ch cap. Hashes and amounts may break anywhere (`overflow-wrap: anywhere`). There are no uppercase transforms and no letter-spacing. The NOW, 24H, 7D and 30D labels are authored that way because the brief names them so.

## Layout

Spacing tokens: `--space-1` 0.25rem, `-2` 0.5rem, `-3` 0.75rem, `-4` 1rem, `-6` 1.5rem, `-8` 2rem, `-12` 3rem.

`main` is a 12-column grid with a maximum width of 88rem, with `--space-12` between rows and `--space-4` between columns. Direct children span all 12 columns unless a breakpoint says otherwise, and they use `min-width: 0` so canvases cannot widen the page. Logical properties are used throughout.

| Width | Behavior |
| --- | --- |
| Under 48rem | One column. Section links scroll sideways on their own row. Block cards are a horizontal snap scroller with the next card peeking. KPIs are 2 x 2. |
| 48rem and up | Top bar is one row. Hero is two columns. Block cards are an auto-fill grid with a 15.5rem minimum. KPIs are in four columns. |
| 60rem and up | Mint spans 7 and supply 5. Wheel spans 8 and events 4. KPIs go back to two columns in the narrower hero. |
| 72rem and up | KPIs are in four columns. |
| `#supply` container at 30rem and up | The vault egg sits beside its stats instead of above them. |

Overlay mode (`html.overlay`) has a root size of `clamp(11px, 0.83vw, 24px)`, fills the viewport with no scrolling, and uses three columns of `26rem 1fr 26rem`. The middle column stays empty for footage and the bottom row holds the latest five block cards. The brand is fixed at the top left.

## Elevation & Depth

Depth comes from translucency, not shadow. `body::before` paints the glows and the 32px grid behind everything at `z-index: -1`. `.panel` and `.block-card` use `--color-surface`, a 1px `--color-line` border, an inset sheen and `backdrop-filter: blur(14px)`. There are no drop shadows. Surfaces never nest: content inside a panel stays flat, separated by space. Overlay mode removes the blur and the page background, leaving the more opaque overlay surface.

## Shapes

`--radius-control` (6px) is for buttons, segments, fields and the skip link. `--radius-card` (12px) is for panels and block cards. Bars, the progress track and swatches use 2px. Mosaic tiles are square with 1px gutters. Egg dots and the status dot are circles. Wheel events use a circular mark and the other event types a square one.

## Components

All are patterns in `src/index.html` and `src/assets/styles.css`, rendered by `src/assets/app.js`. There is no component library.

- **Button** (`.btn`, `.btn-primary`, `.btn-quiet`): 2.75rem minimum height, press scale 0.96 when motion is allowed, hover gated by `@media (hover: hover)`. One `.btn-primary` per view.
- **Segmented control** (`.segmented`): native buttons using `aria-pressed`, used for ranges and event categories. The pressed state combines border, tint and weight.
- **Glass panel** (`.panel`, `.panel-head`): one section with its heading and any controls.
- **Block card** (`.block-card`, `blockCard()` in `app.js`): the mosaic from `drawMosaic()` beside the height, round, blocks, work, SQK minted, a live `<time data-rel>` and an Etherscan link. New cards fade in once.
- **Egg field** (`drawEggs()`): 7 x 9 dot eggs lit from the bottom by share of the largest. Pointer position fills the `#egg-read` readout, and the "Show values" table is the keyboard and screen reader route.
- **Supply vault** (`drawVault()`): a 46 x 59 dot egg, filled bottom up.
- **Wheel bars** (`renderBars()`): a list of bars with hidden text per day. The best day is gold and a null day is a short neutral stub.
- **Heatmap** (`drawHeatmap()`): a day by 48-slot grid plus an average row. No-data slots show a faint dot and zero-work slots a dark tile.
- **Event row** (`eventNode()`): a mark, translated sentence, live time and Etherscan link or "Wheel sensor". Rows sit in `role="log"` and are added without rebuilding the list.
- **Notice** (`.notice`, `renderNotice()`): the plain error or unavailable message with a "Retry now" button, hidden when empty.
- **Live status** (`.status`): dot plus text (Connecting, Live, Reconnecting), so state is not carried by color alone.

## Do's and Don'ts

- Do use `big()` for API numbers and show unknown when it returns null. Don't coerce a missing value to zero.
- Do add strings to all eight tables in `i18n.js` and use whole templates with placeholders. Don't assemble sentences from fragments.
- Do use `setText()` and `el()`, which only set text. Don't use `innerHTML` with API data.
- Do keep green for chain and live state and gold for SQK. Don't add a third accent.
- Do add new polled data as a feed in `feeds` so it gets backoff and hidden-tab handling. Respect the API's rate classes.
- Don't put a surface inside a surface. Don't add drop shadows to bordered panels.
- Do edit `src/` and run `npm run build`. Don't edit `dist/` directly.

To add a section: put a `.panel` with an `h2` in `main`, give it a grid span in the 60rem breakpoint, add its `id` to the section links and to `PANELS` if the overlay should offer it, then give it a grid area under `html.overlay main`.
