// Canvas renderers. Colors mirror the tokens in styles.css, which canvas cannot read directly.
import { MOSAIC_COLS, MOSAIC_ROWS, HEAT_SLOTS, eggDots, litDots, mosaicCells } from './logic.js';

const MOSAIC_GREENS = ['#0d2a1e', '#14532f', '#1f8a4c', '#33c46f', '#6dffa6'];
const HEAT_GREENS = ['#14532f', '#1f8a4c', '#33c46f', '#6dffa6'];
const HEAT_ZERO = '#16302a';
const GOLD = '#ffd257';
const GOLD_DIM = 'rgba(255, 210, 87, 0.2)';
const INK_MUTED = '#a6bbb0';

const SMALL_EGG = eggDots(7, 9);
export const VAULT_COLS = 46;
export const VAULT_ROWS = 59;
const VAULT_EGG = eggDots(VAULT_COLS, VAULT_ROWS);
export const VAULT_DOTS = VAULT_EGG.length;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} width css pixels
 * @param {number} height css pixels
 */
function prepare(canvas, width, height) {
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} hash
 * @param {number} blocks
 */
export function drawMosaic(canvas, hash, blocks) {
  const cell = 6;
  const ctx = prepare(canvas, MOSAIC_COLS * cell, MOSAIC_ROWS * cell);
  const cells = mosaicCells(hash, blocks);
  for (let row = 0; row < MOSAIC_ROWS; row++) {
    for (let col = 0; col < MOSAIC_COLS; col++) {
      ctx.fillStyle = MOSAIC_GREENS[cells[row * MOSAIC_COLS + col]];
      ctx.fillRect(col * cell, row * cell, cell - 1, cell - 1);
    }
  }
}

const HEN = [
  '.........RR.......',
  '........RRRR......',
  '........WWWW......',
  '.......WWBWWYY....',
  '.......WWWWWYY....',
  '.......WWWWWR.....',
  '..W....WWWWWR.....',
  '.WW...WWWWWW......',
  '.WWWWWWWWWWW......',
  '.WWWWSSSSWWW......',
  '.WWWSSSSSSWW......',
  '..WWWSSSSWWW......',
  '..WWWWWWWWW.......',
  '....WWWWWW........',
  '.....O..O.........',
  '....OO.OO.........',
];
const HEN_COLORS = { R: '#ff5a4f', W: '#f4efe2', S: '#cfc6ae', B: '#14201b', Y: '#ffb02e', O: '#f08c1f' };

/** @param {HTMLCanvasElement} canvas */
export function drawHen(canvas) {
  const cell = 5;
  const ctx = prepare(canvas, HEN[0].length * cell, HEN.length * cell);
  HEN.forEach((line, row) => {
    [...line].forEach((key, col) => {
      if (key === '.') return;
      ctx.fillStyle = HEN_COLORS[key];
      ctx.fillRect(col * cell, row * cell, cell, cell);
    });
  });
}

/**
 * A field of small dot-matrix eggs, each lit from the bottom by its share.
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} shares
 * @param {number} width available css width
 * @returns {{stepX: number, stepY: number, eggW: number, eggH: number, perRow: number, count: number}}
 */
export function drawEggs(canvas, shares, width) {
  const count = shares.length;
  const pitch = count <= 12 ? 5 : count <= 30 ? 4 : 3;
  const gap = 6;
  const eggW = 7 * pitch;
  const eggH = 9 * pitch;
  const stepX = eggW + gap;
  const stepY = eggH + gap;
  const perRow = Math.max(1, Math.floor((width + gap) / stepX));
  const lines = Math.ceil(count / perRow) || 1;
  const ctx = prepare(canvas, width, lines * stepY - gap);
  const radius = pitch * 0.38;
  shares.forEach((share, index) => {
    const left = (index % perRow) * stepX;
    const top = Math.floor(index / perRow) * stepY;
    const lit = litDots(share, SMALL_EGG.length);
    SMALL_EGG.forEach((dot, order) => {
      ctx.fillStyle = order < lit ? GOLD : GOLD_DIM;
      ctx.beginPath();
      ctx.arc(left + (dot.x + 0.5) * pitch, top + (dot.y + 0.5) * pitch, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  return { stepX, stepY, eggW, eggH, perRow, count };
}

/**
 * The supply vault: one large dot-matrix egg filled from the bottom.
 * @param {HTMLCanvasElement} canvas
 * @param {number} lit dots to fill
 * @param {number} width available css width
 * @param {number} height available css height
 */
export function drawVault(canvas, lit, width, height) {
  const pitch = Math.max(2, Math.min(6, Math.floor(width / VAULT_COLS), Math.floor(height / VAULT_ROWS)));
  const ctx = prepare(canvas, VAULT_COLS * pitch, VAULT_ROWS * pitch);
  const radius = pitch * 0.36;
  VAULT_EGG.forEach((dot, order) => {
    ctx.fillStyle = order < lit ? GOLD : GOLD_DIM;
    ctx.beginPath();
    ctx.arc((dot.x + 0.5) * pitch, (dot.y + 0.5) * pitch, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * @typedef {{label: string, cells: {work: number | null, partial: boolean}[]}} HeatRow
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HeatRow[]} rows day rows; the last row is drawn apart as the typical day
 * @param {number} width available css width
 * @param {number} labelEvery label every Nth day row
 * @returns {{gutter: number, top: number, cellW: number, cellH: number, rowCount: number, typicalTop: number, width: number}}
 */
export function drawHeatmap(canvas, rows, width, labelEvery) {
  const gutter = 48;
  const top = 18;
  const days = rows.length - 1;
  const cellH = days > 10 ? 7 : 14;
  const typicalGap = 8;
  const typicalH = 14;
  const height = top + days * cellH + typicalGap + typicalH;
  const cellW = (width - gutter) / HEAT_SLOTS;
  const ctx = prepare(canvas, width, height);
  const typicalTop = top + days * cellH + typicalGap;

  const peakOf = (best, row) => row.cells.reduce((m, c) => (c.work !== null && c.work > m ? c.work : m), best);
  const dayPeak = rows.slice(0, days).reduce(peakOf, 0);
  const typicalPeak = peakOf(0, rows[days]);

  ctx.font = '12px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK_MUTED;
  ctx.textAlign = 'start';
  for (const hour of [0, 6, 12, 18]) {
    ctx.fillText(`${String(hour).padStart(2, '0')}:00`, gutter + hour * 2 * cellW, top / 2);
  }

  rows.forEach((row, index) => {
    const isTypical = index === days;
    const y = isTypical ? typicalTop : top + index * cellH;
    const h = isTypical ? typicalH : cellH;
    const scale = isTypical ? typicalPeak : dayPeak;
    if (isTypical || index % labelEvery === 0) {
      ctx.fillStyle = INK_MUTED;
      ctx.fillText(row.label, 0, y + h / 2);
    }
    row.cells.forEach((cell, slot) => {
      const x = gutter + slot * cellW;
      if (cell.work === null) {
        ctx.fillStyle = 'rgba(166, 187, 176, 0.25)';
        ctx.fillRect(x + cellW / 2 - 0.5, y + h / 2 - 0.5, 1, 1);
        return;
      }
      ctx.globalAlpha = cell.partial ? 0.6 : 1;
      if (cell.work === 0 || scale === 0) ctx.fillStyle = HEAT_ZERO;
      else ctx.fillStyle = HEAT_GREENS[Math.min(3, Math.floor((cell.work / scale) * 4))];
      ctx.fillRect(x, y, Math.max(1, cellW - 0.75), h - 1);
      ctx.globalAlpha = 1;
    });
  });
  return { gutter, top, cellW, cellH, rowCount: days, typicalTop, width };
}
