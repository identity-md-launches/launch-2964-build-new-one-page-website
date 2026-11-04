# SqueekPulse design system

## Overview

SqueekPulse is a telemetry console and OBS overlay for Squeekchain followers and streamers. Preserve its dark cyber-glass panels, emerald chain data, gold SQK data, pixel mosaics and dot-matrix eggs. The normal console remains a scrolling dashboard. Overlay mode adds one central instrument, the Squeekchain Nexus Sphere, between the existing side panels and five bottom settlement cards.

The final source is `src/`; `dist/` is its production copy. Shared tokens live in `src/assets/styles.css`. `src/assets/nexus.css`, loaded afterwards, provides the overlay extension. Browser coverage and qualifications are in `VALIDATION.md`.

## Colors

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#07110e` | Console background and control surfaces |
| `--color-surface` | `rgba(18,38,31,0.62)` | Normal glass panels |
| `--color-surface-overlay` | `rgba(6,16,13,0.82)` normally; overridden to `rgba(6,16,13,0.94)` in overlay | Overlay panels and local text backplates |
| `--color-line` | `rgba(140,255,200,0.18)` | Structural borders |
| `--color-line-strong` | `rgba(140,255,200,0.42)` | Control borders |
| `--color-sheen` | `rgba(255,255,255,0.06)` | Normal panel's inset highlight |
| `--color-text` | `#e9f6ef` | Main text |
| `--color-text-muted` | `#a6bbb0` | Labels, timestamps and help |
| `--color-chain` | `#5dfba0` | Chain links, sphere, wire mesh and live state |
| `--color-chain-solid` | `#39e58c` | Primary action and distance bars |
| `--color-on-chain` | `#04140c` | Text on the filled action |
| `--color-mint` | `#ffd257` | SQK, sphere highlights, supply/mint tethers and progress arc |
| `--color-warning` | `#ffb86b` | Delayed, paused and error text |
| `--color-focus` | `#ffffff` | Visible keyboard focus |

`nexus.js` mirrors chain/mint colors as `EMERALD` and `GOLD`; `draw.js` retains its existing mosaic and heatmap palettes. Change these with their corresponding CSS roles. Glow belongs to Canvas geometry, not prose or cards.

Nexus text sits on local 94% dark backplates so transparency remains usable over footage. Calculated contrast for those backplates composited over white: primary 15.27:1, muted 8.37:1, emerald 12.75:1, gold 11.81:1, warning 9.96:1. The primary action pair is 11.49:1. These calculations cover the stated pairs, not every possible underlying video frame or pre-existing transparent label.

## Typography

Reuse the five existing size tokens: `--text-xs` 0.75rem, `--text-sm` 0.875rem, `--text-md` 1rem, `--text-lg` 1.25rem and `--text-xl` 1.75rem. Use weights 400 and 600. Labels, prose, headings and controls use `--font-sans` (system-ui with CJK, Korean and other system fallbacks). Values and hashes use `--font-mono` with tabular numbers. There are no downloaded fonts, tracked labels or uppercase transforms.

Body line-height is 1.5; headings use 1.1–1.25. Nexus metric values use 1.25 and `overflow-wrap: anywhere`; each metric is limited to 46% of stage width to keep left/right values distinct. Long height/round values wrap, rather than truncate. Phone HUD values use `--text-lg`.

Normal root size is 16px. The broadcast overlay uses `clamp(12px,0.83vw,20px)` to scale with the frame; compact desktop captions can consequently be below 12 CSS pixels. Scrolling overlay layouts restore the root to 16px. This is a broadcast-density choice, not a recommendation for general body copy.

## Layout

Shared spacing tokens are 4, 8, 12, 16, 24, 32 and 48px at the normal root. The normal dashboard uses a 12-column grid with an 88rem maximum, one column below 48rem, and its existing section spans at 60rem.

The broadcast overlay is a viewport grid with two side columns of at least 250px/23% and a flexible center. Mint spans the top two left rows; supply occupies the third left row. Telemetry, events and wheel occupy the three right rows. The center spans those rows; the bottom row contains the latest five settlement cards. Main padding is 4.5rem at the top and 1.5rem elsewhere; row/column gaps are 1rem/2.5rem.

| Condition | Implemented overlay behavior |
| --- | --- |
| At least 1100px wide and 700px tall | Broadcast composition; body stays transparent and does not scroll; dense side panels can scroll internally |
| Below either threshold | Scrolling page; sphere first, then two panel columns; settlements in two columns |
| Below 600px wide | One column; sphere/HUD/controls first; telemetry and all other panels remain reachable; five cards stack vertically |
| Reduced motion | Static sphere and packets, with live text/progress updates and explicit manual exploration |

The sphere stage flexes to fill center height. Base radius is 31% of the smaller stage dimension; its HUD ring is 1.32 times that radius. Mobile paths follow outer gutters rather than running down the control area. Widths 320, 390, 1024, 1100, 1440 and 1920 were checked in Chromium, including 390px locales and long values.

## Elevation & depth

Normal panels retain the existing translucent surface, structural border, inset sheen and 14px backdrop blur. Overlay panels remove sheen/blur and use the stronger dark surface. Text backplates have no border or shadow. The page background remains transparent.

`main` creates an isolated stacking context. `#nexus-canvas` is an absolutely positioned, decorative layer at z-index 0; panels and semantic Nexus content are at 1, and the brand is at 3. Canvas cannot receive pointer events. Only the sphere's DOM hit area and actual controls accept input. Tethers therefore cannot block panel controls or transaction links.

## Shapes

Keep existing 6px control and 12px card radii. The sphere's hit area is elliptical and shows a 2px white keyboard outline. HUD backplates remain flat. The mesh uses perspective and depth-sorted particles, with a tilted gold orbit; its circular HUD has 120 ticks and an API-driven gold progress arc. Each connection ends in a small glowing port. There is no surrounding card or frame around the sphere.

## Components

| Pattern and source | Behavior and states |
| --- | --- |
| Existing `.btn`, `styles.css` | Native buttons/links, named 150ms transitions, visible focus; primary fill uses chain green |
| `.nexus-controls`, `nexus.css` | Four native controls with 44px minimum height; zoom controls also 44px wide; wrap for translated labels; paused button stays opaque over footage |
| `#nexus-orbit`, `nexus.js` | Focusable named group with adjacent instructions; drag/arrow rotation, desktop wheel or +/− zoom, Home reset, Space pause; modifier shortcuts pass through, and touch permits vertical scrolling and browser pinch zoom |
| `.nexus-hud`, `src/index.html` | Semantic definition list for live height, settled round ID and progress; no text is painted into Canvas; unknown values remain unknown |
| `#nexus-feed`, `nexus.js` | Stable status region for waiting, live, delayed, unavailable and core-paused; text accompanies color; stale errors take precedence over cached paused state |
| `createNexus()`, `nexus.js` | Overlay-only renderer; DOM-derived endpoints; refreshes geometry after resizing, hidden-panel changes and card replacement; pauses automatic drawing for hidden tabs and motion preferences |
| `.block-card`, `app.js` / `styles.css` | Existing 13×24 seeded mosaic, real settlement values, relative time and Sepolia transaction link; first five cards are tethered in overlay mode |
| `renderNotice()`, `app.js` | Names the affected panel and offers its existing Retry now action; no repeated generic failure paragraph |

All added strings are in `nexus-i18n.js`, merged into the existing eight-language dictionary. The regular dashboard's filters, range controls, events, copy-link flow and language preference are retained.

## Do's and don'ts

- Use existing color, size, spacing and control tokens; keep prose in the system sans and data in monospace.
- Keep chain values in the semantic HUD. Packet animation illustrates a connection and must not imply measured throughput or invented transactions.
- Add an anchor to `measure()` when adding a connected overlay panel; query its actual rectangle and exclude hidden/missing content. Never position a tether from a screenshot coordinate.
- Keep input separate from the decorative Canvas so existing controls remain clickable. Preserve keyboard equivalents, readable backplates and reduced-motion behavior.
- Edit `src/`, rebuild `dist/`, and rerun affected browser checks. Tests and fixtures belong outside the static export.

Design guidance credit: Better Interface by Jakub Krehel (MIT). Documentation method credit: Impeccable by Paul Bakaus (Apache-2.0), using the assignment's pinned references.
