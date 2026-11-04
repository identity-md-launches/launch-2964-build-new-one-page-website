// Pure helpers with no DOM access, so they can run under node:test.

const SQK_UNIT = 10n ** 18n;

export const MOSAIC_COLS = 13;
export const MOSAIC_ROWS = 24;
export const HEAT_SLOTS = 48;
export const PANELS = ['blocks', 'mint', 'supply', 'wheel', 'events'];

/**
 * Big numbers arrive as decimal strings. Missing or malformed values stay unknown, never zero.
 * @param {unknown} value
 * @returns {bigint | null}
 */
export function big(value) {
  if (value === null || value === undefined || value === '') return null;
  try {
    return BigInt(/** @type {string} */ (value));
  } catch {
    return null;
  }
}

/**
 * @param {unknown} baseUnits
 * @returns {number | null} whole SQK, precise to four decimals
 */
export function sqkNumber(baseUnits) {
  const value = big(baseUnits);
  if (value === null) return null;
  return Number(value / (SQK_UNIT / 10000n)) / 10000;
}

/**
 * @param {unknown} part
 * @param {unknown} whole
 * @returns {number | null} part / whole, precise to six decimals
 */
export function fraction(part, whole) {
  const a = big(part);
  const b = big(whole);
  if (a === null || b === null || b === 0n) return null;
  return Number((a * 1000000n) / b) / 1000000;
}

/** @param {unknown} mm @returns {number | null} */
export function mmToKm(mm) {
  const value = big(mm);
  return value === null ? null : Number(value) / 1000000;
}

/** @param {string | null | undefined} value */
export function shortHash(value) {
  if (!value) return '';
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/** @param {unknown} hash @returns {string | null} */
export function txUrl(hash) {
  if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

/** @param {number} minute minutes after 00:00 */
export function slotLabel(minute) {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** @param {string} text */
function seedFrom(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** @param {number} seed */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The 13x24 settlement mosaic: mirrored left to right, seeded by the transaction hash, lit more
 * densely the more blocks the settlement completed.
 * @param {string} hash
 * @param {number} blocks
 * @returns {Uint8Array} MOSAIC_COLS * MOSAIC_ROWS levels from 0 (dark) to 4 (brightest)
 */
export function mosaicCells(hash, blocks) {
  const random = mulberry32(seedFrom(hash));
  const density = 0.38 + (Math.min(Math.max(blocks, 0), 64) / 64) * 0.5;
  const cells = new Uint8Array(MOSAIC_COLS * MOSAIC_ROWS);
  const half = (MOSAIC_COLS + 1) / 2;
  for (let row = 0; row < MOSAIC_ROWS; row++) {
    for (let col = 0; col < half; col++) {
      const lit = random() < density;
      const shade = random();
      const level = lit ? 1 + Math.floor(shade * 4) : 0;
      cells[row * MOSAIC_COLS + col] = level;
      cells[row * MOSAIC_COLS + (MOSAIC_COLS - 1 - col)] = level;
    }
  }
  return cells;
}

/**
 * Egg outline on a dot grid.
 * @param {number} cols
 * @param {number} rows
 * @returns {{x: number, y: number}[]} dots ordered bottom row first, left to right, so filling the
 * first N dots fills the egg from the bottom up
 */
export function eggDots(cols, rows) {
  const dots = [];
  for (let row = rows - 1; row >= 0; row--) {
    const y = ((row + 0.5) / rows) * 2 - 1;
    const half = (Math.sqrt(Math.max(0, 1 - y * y)) * (1 + 0.2 * y)) / 1.02;
    for (let col = 0; col < cols; col++) {
      const x = ((col + 0.5) / cols) * 2 - 1;
      if (Math.abs(x) <= half) dots.push({ x: col, y: row });
    }
  }
  return dots;
}

/**
 * Dots to light for a share. Any non-zero share shows at least one dot.
 * @param {number} share 0 to 1
 * @param {number} total
 */
export function litDots(share, total) {
  if (!(share > 0)) return 0;
  return Math.min(total, Math.max(1, Math.round(share * total)));
}

/**
 * @param {string} href the page's own address
 * @param {string} lang
 * @param {Iterable<string>} panels
 */
export function overlayUrl(href, lang, panels) {
  const url = new URL(href);
  url.hash = '';
  url.search = '';
  url.searchParams.set('overlay', '1');
  url.searchParams.set('lang', lang);
  const chosen = PANELS.filter((name) => [...panels].includes(name));
  if (chosen.length !== PANELS.length) url.searchParams.set('panels', chosen.join(','));
  return url.toString();
}

/**
 * @param {string} search location.search
 * @returns {{overlay: boolean, lang: string | null, panels: string[], wheel: string}}
 */
export function readParams(search) {
  const params = new URLSearchParams(search);
  const asked = params.get('panels');
  const panels = asked === null ? PANELS : PANELS.filter((name) => asked.split(',').includes(name));
  return {
    overlay: params.get('overlay') === '1',
    lang: params.get('lang'),
    panels: [...panels],
    wheel: params.get('wheel') === '30d' ? '30d' : '7d',
  };
}

/**
 * Backoff for a failing feed, honouring Retry-After when the response exposes it.
 * @param {number} failures consecutive failures, starting at 1
 * @param {number} retryAfterSeconds
 * @param {number} baseMs
 */
export function retryDelay(failures, retryAfterSeconds, baseMs) {
  const backoff = Math.min(300000, baseMs * 2 ** Math.max(0, failures - 1));
  return Math.max(backoff, retryAfterSeconds * 1000);
}

/**
 * Which stream category a typed event belongs to.
 * @param {string} type
 */
export function eventGroup(type) {
  const head = String(type).split('.')[0];
  if (head === 'system') return 'protocol';
  if (head === 'measurement') return 'measurement';
  return 'players';
}
