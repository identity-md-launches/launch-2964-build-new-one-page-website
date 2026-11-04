// SqueekPulse console. Polls the public read API; the docs define no push stream.
import { LANGS, translate, hasKey, localeOf, pickLang } from './i18n.js';
import {
  HEAT_SLOTS, PANELS, big, eventGroup, fraction, litDots, mmToKm, overlayUrl, readParams,
  retryDelay, shortHash, slotLabel, sqkNumber, txUrl,
} from './logic.js';
import { VAULT_DOTS, drawEggs, drawHeatmap, drawHen, drawMosaic, drawVault } from './draw.js';

const API = 'https://api.squeekchain.com/v1';
const LANG_KEY = 'squeekpulse.lang';
const MINT_CYCLE = ['now', '24h', '7d', '30d'];

/** @returns {any} */
const $ = (id) => document.getElementById(id);

const params = readParams(location.search);

const state = {
  lang: 'en',
  overlay: params.overlay,
  kitPanels: new Set(PANELS),
  core: null,
  coreAt: 0,
  economy: null,
  now: null,
  ranges: {},
  stats: {},
  mintRange: 'now',
  wheelRange: params.wheel,
  eventCat: 'all',
  paused: false,
  events: [],
  eventIds: new Set(),
  eventCursor: undefined,
  eventsLoaded: false,
  eventsUnavailable: null,
  lastOk: 0,
  blockSig: null,
  blockHashes: new Set(),
  latestMintRound: null,
  mintItems: [],
  eggLayout: null,
  eggPinned: null,
  heatRows: [],
  heatLayout: null,
  heatPinned: null,
  heatPeak: null,
};

/** @type {ReturnType<import('./nexus.js').createNexus> | null} */
let nexus = null;

/* Text and number formatting */

let fmt = buildFormatters('en');

/** @param {string} lang */
function buildFormatters(lang) {
  const locale = localeOf(lang);
  return {
    int: new Intl.NumberFormat(locale),
    compact: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }),
    amount: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    small: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    decimal1: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    km: new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 1 }),
    percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }),
    relative: new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }),
    day: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    dayNumeric: new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', timeZone: 'UTC' }),
    dateTime: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }),
  };
}

/** @param {string} key @param {Record<string, unknown>} [vars] */
const t = (key, vars) => translate(state.lang, key, vars);

/** @param {unknown} value */
function intText(value) {
  const number = big(value);
  return number === null ? t('unknown') : fmt.int.format(number);
}

/** @param {unknown} baseUnits */
function sqkText(baseUnits) {
  const amount = sqkNumber(baseUnits);
  if (amount === null) return t('unknown');
  if (amount >= 1000000) return fmt.compact.format(amount);
  return amount >= 100 ? fmt.amount.format(amount) : fmt.small.format(amount);
}

/** @param {unknown} mm */
function kmText(mm) {
  const km = mmToKm(mm);
  return km === null ? t('noData') : fmt.km.format(km);
}

/** @param {number} timestamp */
function relativeText(timestamp) {
  const seconds = (timestamp - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return fmt.relative.format(Math.round(seconds), 'second');
  if (abs < 3600) return fmt.relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return fmt.relative.format(Math.round(seconds / 3600), 'hour');
  return fmt.relative.format(Math.round(seconds / 86400), 'day');
}

/** @param {string} isoDate YYYY-MM-DD @param {any} formatter */
function dayText(isoDate, formatter) {
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isNaN(parsed) ? isoDate : formatter.format(parsed);
}

/* DOM helpers */

/**
 * @param {string} tag
 * @param {Record<string, unknown>} [props]
 * @param {(Node | null | undefined | false)[]} kids
 * @returns {any}
 */
function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else node.setAttribute(key, String(value));
  }
  for (const kid of kids) if (kid) node.append(kid);
  return node;
}

/** @param {string} iso */
function timeEl(iso) {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return el('time', { text: t('unknown') });
  return el('time', {
    datetime: iso,
    'data-rel': timestamp,
    title: `${fmt.dateTime.format(timestamp)} UTC`,
    text: relativeText(timestamp),
  });
}

/** @param {string} id @param {string} text */
function setText(id, text) {
  const node = $(id);
  if (node.textContent !== text) node.textContent = text;
}

/** @param {any} list @param {string[][]} rows */
function fillStats(list, rows) {
  list.replaceChildren(...rows.map(([label, value]) => el('div', {}, el('dt', { text: label }), el('dd', { text: value }))));
}

/** @param {any} group @param {string} attr @param {string} active */
function setPressed(group, attr, active) {
  for (const button of group.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.getAttribute(attr) === active));
  }
}

/** A failed render must not take the other panels down with it. @param {string} name @param {() => void} fn */
function safely(name, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`SqueekPulse: ${name} failed`, error);
  }
}

/* Data feeds */

/** @param {string} path */
async function getJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    // no-cache makes the browser revalidate with the API's ETag on every poll.
    const response = await fetch(API + path, { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) {
      const error = /** @type {any} */ (new Error(`HTTP ${response.status}`));
      error.retryAfter = Number(response.headers.get('Retry-After')) || 0;
      throw error;
    }
    const data = await response.json();
    if (typeof data !== 'object' || data === null || typeof data.schemaVersion !== 'number') {
      throw new Error('Malformed response');
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @typedef {{name: string, every: number, seq: number, fails: number, error: any, timer: any,
 *   path: () => string | null, apply: (data: any) => void, render: () => void}} Feed
 */

/** @type {Record<string, Feed>} */
const feeds = {
  core: {
    name: 'core', every: 15000, seq: 0, fails: 0, error: null, timer: null,
    path: () => '/core',
    apply: (data) => { state.core = data; state.coreAt = Date.now(); },
    render: () => renderCore(),
  },
  now: {
    name: 'settlements', every: 15000, seq: 0, fails: 0, error: null, timer: null,
    path: () => '/settlements',
    apply: (data) => { state.now = data; },
    render: () => { renderBlocks(); if (state.mintRange === 'now') renderMint(); },
  },
  mint: {
    name: 'mint range', every: 60000, seq: 0, fails: 0, error: null, timer: null,
    path: () => (state.mintRange === 'now' ? null : `/settlements?range=${state.mintRange}`),
    apply: (data) => { state.ranges[data.range || state.mintRange] = data; },
    render: () => renderMint(),
  },
  economy: {
    name: 'economy', every: 15000, seq: 0, fails: 0, error: null, timer: null,
    path: () => '/economy/state',
    apply: (data) => { state.economy = data; },
    render: () => renderSupply(),
  },
  // The docs call stats too heavy to poll, so this refreshes slowly and on a range change.
  stats: {
    name: 'stats', every: 600000, seq: 0, fails: 0, error: null, timer: null,
    path: () => `/measurement/stats?range=${state.wheelRange}`,
    apply: (data) => { state.stats[data.range || state.wheelRange] = data; },
    render: () => renderWheel(),
  },
  events: {
    name: 'events', every: 15000, seq: 0, fails: 0, error: null, timer: null,
    path: () => (state.paused ? null : `/events?category=${state.eventCat}&limit=30`),
    apply: (data) => mergeEvents(data),
    render: () => renderEventState(),
  },
};

/** @param {Feed} feed */
async function run(feed) {
  clearTimeout(feed.timer);
  feed.timer = null;
  const path = feed.path();
  if (!path || document.hidden) return;
  const seq = ++feed.seq;
  try {
    const data = await getJson(path);
    if (seq !== feed.seq) return;
    feed.fails = 0;
    feed.error = null;
    state.lastOk = Date.now();
    safely(feed.name, () => feed.apply(data));
    safely(feed.name, feed.render);
    feed.timer = setTimeout(() => run(feed), feed.every);
  } catch (error) {
    if (seq !== feed.seq) return;
    feed.fails += 1;
    feed.error = error;
    console.warn(`SqueekPulse: ${feed.name} request failed`, error);
    safely(feed.name, feed.render);
    feed.timer = setTimeout(() => run(feed), retryDelay(feed.fails, error.retryAfter || 0, feed.every));
  }
  renderStatus();
}

/**
 * @param {string} id
 * @param {Feed} feed
 * @param {any} data
 */
function renderNotice(id, feed, data) {
  const box = $(id);
  box.replaceChildren();
  // HTTP 200 with status "unavailable" means unknown: say so instead of showing zero.
  if (data && data.status === 'unavailable') {
    box.append(el('p', { text: t('unavailable', { reason: data.reason || t('unknown') }) }));
    return;
  }
  if (feed.error) {
    const retry = el('button', { type: 'button', class: 'btn btn-quiet', text: t('retry') });
    retry.addEventListener('click', () => run(feed));
    const labels = { 'hero-notice': 'overview', 'blocks-notice': 'blocksTitle', 'mint-notice': 'mintTitle', 'supply-notice': 'supplyTitle', 'wheel-notice': 'wheelTitle', 'events-notice': 'eventsTitle' };
    box.append(el('p', { text: t('errorLoad', { feed: t(labels[id] || 'overview') }) }), retry);
  }
}

/* Status and overview */

function renderStatus() {
  const watched = [feeds.core, feeds.now, feeds.economy, feeds.events];
  const failing = watched.some((feed) => feed.error);
  const stateName = failing ? 'retrying' : state.lastOk ? 'live' : 'connecting';
  const node = $('status');
  node.dataset.state = stateName;
  const key = { retrying: 'statusRetrying', live: 'statusLive', connecting: 'statusConnecting' }[stateName];
  setText('status-text', t(key));
  setText('updated', state.lastOk ? t('updated', { time: relativeText(state.lastOk) }) : '');
  nexus?.sync();
}

function renderCore() {
  const data = state.core;
  const core = data ? data.core : null;
  renderNotice('hero-notice', feeds.core, data);
  setText('kpi-height', core ? intText(core.blockHeight) : '-');
  setText('kpi-round', core ? intText(core.settledThroughRound) : '-');
  setText('kpi-work', core ? intText(core.workPerThousandBlocks) : '-');
  setText('kpi-safe', data && data.chain ? intText(data.chain.safeThroughBlock) : '-');
  const share = core && data.configuration ? fraction(core.blockProgress, data.configuration.blockUnitsPerBlock) : null;
  $('kpi-progress').value = share === null ? 0 : share * 100;
  setText('kpi-progress-text', share === null ? '-' : fmt.percent.format(share));
  $('core-paused').hidden = !(core && core.paused);
}

/* Settled block cards */

/** @param {any} row @param {boolean} isNew */
function blockCard(row, isNew) {
  const hash = row.transactionHash;
  const url = txUrl(hash);
  const mosaic = el('canvas', { 'aria-hidden': 'true' });
  drawMosaic(mosaic, String(hash), Number(row.completedBlockCount) || 0);
  return el(
    'article',
    { class: isNew ? 'block-card is-new' : 'block-card' },
    mosaic,
    el(
      'div',
      { class: 'block-body' },
      el('h3', { text: t('cardBlock', { height: row.blockHeight }) }),
      el('p', { text: t('cardRound', { round: row.settledThroughRound }) }),
      el('p', { text: t('cardDone', { count: row.completedBlockCount }) }),
      el('p', { text: t('cardWork', { work: intText(row.workAdded) }) }),
      el('p', { class: 'minted', text: `${sqkText(row.sqkMintedBaseUnits)} SQK` }),
      timeEl(row.blockTimestamp),
      url && el('a', {
        href: url,
        target: '_blank',
        rel: 'noopener',
        title: t('txAria', { hash }),
        text: t('txLink', { hash: shortHash(hash) }),
      }),
    ),
  );
}

function renderBlocks() {
  const data = state.now;
  renderNotice('blocks-notice', feeds.now, data);
  const box = $('block-list');
  if (!data) {
    if (feeds.now.error) box.replaceChildren();
    return;
  }
  const rows = Array.isArray(data.recentSettlements) ? data.recentSettlements : [];
  const signature = state.lang + rows.map((row) => row.transactionHash).join();
  if (signature === state.blockSig) return;
  const firstPaint = state.blockSig === null;
  const known = state.blockHashes;
  if (rows.length === 0) {
    box.replaceChildren(el('p', { class: 'help', text: t('blocksEmpty') }));
  } else {
    box.replaceChildren(...rows.map((row) => blockCard(row, !firstPaint && !known.has(row.transactionHash))));
  }
  state.blockSig = signature;
  state.blockHashes = new Set(rows.map((row) => row.transactionHash));
}

/* SQK mint tracker */

function mintView() {
  const range = state.mintRange;
  if (range === 'now') {
    const data = state.now;
    if (!data) return null;
    const rounds = Array.isArray(data.recentRounds) ? data.recentRounds : [];
    let total = 0n;
    let minted = 0;
    for (const round of rounds) {
      const amount = big(round.sqkMintedBaseUnits);
      if (amount !== null && amount > 0n) {
        total += amount;
        minted += 1;
      }
    }
    const last = rounds[rounds.length - 1];
    return {
      data,
      total,
      totalLabel: t('mintRecent', { count: rounds.length }),
      stats: [
        [t('mintRounds'), `${minted} / ${rounds.length}`],
        [t('mintLatest'), last ? String(last.roundId) : t('unknown')],
      ],
      help: t('eggHelpNow'),
      items: rounds.map((round) => ({
        label: t('cardRound', { round: round.roundId }),
        when: round.endAt,
        amount: big(round.sqkMintedBaseUnits),
      })),
    };
  }
  const data = state.ranges[range];
  if (!data) return null;
  const summary = data.summary || {};
  const buckets = Array.isArray(data.buckets) ? data.buckets : [];
  return {
    data,
    total: data.mining ? data.mining.rangeMintedBaseUnits : null,
    totalLabel: t('mintRange'),
    stats: [
      [t('mintActive'), intText(summary.activeRoundCount)],
      [t('mintBlocks'), intText(summary.completedBlockCount)],
      [t('mintWork'), intText(summary.workAdded)],
    ],
    help: t({ '24h': 'eggHelp24h', '7d': 'eggHelp7d', '30d': 'eggHelp30d' }[range]),
    items: buckets.map((bucket) => ({
      label: fmt.dateTime.format(Date.parse(bucket.startAt)),
      when: bucket.endAt,
      amount: big(bucket.sqkMintedBaseUnits),
    })),
  };
}

/** @param {{label: string, amount: bigint | null}} item */
function eggReadText(item) {
  return `${item.label}: ${item.amount === null ? t('unknown') : `${sqkText(item.amount)} SQK`}`;
}

function renderMint() {
  setPressed($('mint-ranges'), 'data-range', state.mintRange);
  const view = mintView();
  renderNotice('mint-notice', state.mintRange === 'now' ? feeds.now : feeds.mint, view ? view.data : null);
  if (!view) {
    setText('mint-total', '-');
    setText('mint-total-label', feeds.mint.error ? '' : t('loading'));
    return;
  }
  setText('mint-total', sqkText(view.total));
  setText('mint-total-label', view.totalLabel);
  setText('egg-help', view.help);
  fillStats($('mint-stats'), view.stats);
  state.mintItems = view.items;
  state.eggPinned = null;
  drawMintEggs();
  const table = $('mint-table');
  table.replaceChildren(...[...view.items].reverse().map((item) => el(
    'tr',
    {},
    el('td', { text: item.label }),
    el('td', { text: item.amount === null ? t('unknown') : sqkText(item.amount) }),
  )));
  renderEggRead();
  renderNextRound();
  markHenLaid();
}

function drawMintEggs() {
  const canvas = $('egg-canvas');
  const width = canvas.parentElement.clientWidth;
  if (!width) return;
  const items = state.mintItems;
  let largest = 0n;
  for (const item of items) if (item.amount !== null && item.amount > largest) largest = item.amount;
  const shares = items.map((item) => (item.amount === null || largest === 0n ? 0 : Number((item.amount * 1000n) / largest) / 1000));
  state.eggLayout = drawEggs(canvas, shares, width);
  canvas.setAttribute('aria-label', t('eggsAria', { count: items.length, amount: sqkText(largest) }));
}

function renderEggRead() {
  const items = state.mintItems;
  const item = items[state.eggPinned ?? items.length - 1];
  setText('egg-read', item ? eggReadText(item) : '');
}

/** @param {any} event */
function onEggPointer(event) {
  const layout = state.eggLayout;
  if (!layout) return;
  const box = event.currentTarget.getBoundingClientRect();
  const col = Math.floor((event.clientX - box.left) / layout.stepX);
  const row = Math.floor((event.clientY - box.top) / layout.stepY);
  const index = row * layout.perRow + col;
  if (col < 0 || col >= layout.perRow || index < 0 || index >= layout.count) return;
  state.eggPinned = index;
  renderEggRead();
}

function renderNextRound() {
  const node = $('next-round');
  const next = state.mintRange === 'now' && state.now && state.now.mining ? state.now.mining.nextRound : null;
  if (!next || !next.endsAt) {
    setText('next-round', '');
    node.hidden = true;
    return;
  }
  node.hidden = false;
  const ends = Date.parse(next.endsAt);
  const key = ends > Date.now() ? 'nextOpen' : 'nextPending';
  setText('next-round', t(key, { round: next.round, time: relativeText(ends) }));
}

// The hen pecks once when a newly settled round mints.
function markHenLaid() {
  const rounds = state.now && Array.isArray(state.now.recentRounds) ? state.now.recentRounds : [];
  const latest = [...rounds].reverse().find((round) => {
    const amount = big(round.sqkMintedBaseUnits);
    return amount !== null && amount > 0n;
  });
  const id = latest ? latest.roundId : null;
  if (state.latestMintRound !== null && id !== null && id !== state.latestMintRound) {
    const hen = $('hen');
    hen.classList.remove('laid');
    void hen.getBoundingClientRect();
    hen.classList.add('laid');
  }
  if (id !== null) state.latestMintRound = id;
}

/** @param {string} range */
function setMintRange(range) {
  state.mintRange = range;
  clearTimeout(feeds.mint.timer);
  feeds.mint.seq += 1;
  feeds.mint.error = null;
  safely('mint', renderMint);
  run(feeds.mint);
}

/* SQK supply vault */

function renderSupply() {
  const data = state.economy;
  renderNotice('supply-notice', feeds.economy, data);
  const supply = data ? data.supply : null;
  setText('supply-live', supply ? sqkText(supply.liveSupplyBaseUnits) : '-');
  setText('supply-cap', supply ? sqkText(supply.capBaseUnits) : '-');
  setText('supply-unminted', supply ? sqkText(supply.unmintedCapacityBaseUnits) : '-');
  setText('supply-burned', supply ? sqkText(supply.totalBurnedBaseUnits) : '-');
  setText('supply-staked', data && data.staking ? sqkText(data.staking.totalStakedBaseUnits) : '-');
  const share = supply ? fraction(supply.liveSupplyBaseUnits, supply.capBaseUnits) : null;
  const shareText = share === null ? t('unknown') : fmt.percent.format(share);
  setText('supply-share', share === null ? '' : t('supplyShare', { share: shareText }));
  const cap = supply ? sqkNumber(supply.capBaseUnits) : null;
  setText('supply-dot', cap === null ? '' : t('supplyDot', { amount: fmt.compact.format(cap / VAULT_DOTS) }));
  drawSupplyVault(share);
}

/** @param {number | null} share */
function drawSupplyVault(share) {
  const canvas = $('vault-canvas');
  const wrap = $('vault-wrap');
  const width = wrap.clientWidth;
  if (!width) return;
  const height = state.overlay ? wrap.clientHeight : 354;
  const lit = share === null ? 0 : litDots(share, VAULT_DOTS);
  drawVault(canvas, lit, width, height);
  canvas.setAttribute('aria-label', share === null
    ? t('loading')
    : t('vaultAria', { dots: VAULT_DOTS, filled: lit, share: fmt.percent.format(share) }));
}

/* Hamster wheel chart and heatmap */

function renderWheel() {
  const range = state.wheelRange;
  setPressed($('wheel-ranges'), 'data-range', range);
  const data = state.stats[range];
  renderNotice('wheel-notice', feeds.stats, data);
  const activity = data ? data.activity : null;
  if (!activity) {
    $('bars').replaceChildren();
    return;
  }
  const days = Array.isArray(activity.days) ? activity.days : [];
  renderBars(days, range);

  const summary = activity.summary || {};
  let best = null;
  for (const day of days) {
    const mm = big(day.distanceMm);
    if (mm !== null && (best === null || mm > best.mm)) best = { mm, date: day.date };
  }
  fillStats($('wheel-stats'), [
    [t('wheelTotal'), kmText(summary.observedDistanceMm)],
    [t('wheelAvg'), kmText(summary.averageDistancePerActiveDayMm)],
    [t('wheelBest'), best ? `${kmText(best.mm)} (${dayText(best.date, fmt.day)})` : t('noData')],
    [t('wheelLifetime'), kmText(data.lifetime ? data.lifetime.observedDistanceMm : null)],
  ]);

  state.heatRows = heatRows(days, activity.typicalDay);
  state.heatPeak = typeof summary.peakWindowStartMinuteUtc === 'number' ? slotLabel(summary.peakWindowStartMinuteUtc) : null;
  state.heatPinned = null;
  drawWheelHeat();
  renderHeatRead();
}

/** @param {any[]} days @param {string} range */
function renderBars(days, range) {
  let largest = 0n;
  let bestIndex = -1;
  days.forEach((day, index) => {
    const mm = big(day.distanceMm);
    if (mm !== null && mm > largest) {
      largest = mm;
      bestIndex = index;
    }
  });
  const showEvery = range === '7d' ? 1 : 5;
  const items = days.map((day, index) => {
    const mm = big(day.distanceMm);
    const percent = mm === null || largest === 0n ? 0 : Math.max(2, Number((mm * 1000n) / largest) / 10);
    const height = mm === null ? 3 : percent;
    const label = `${dayText(day.date, fmt.day)}: ${kmText(mm)}`;
    const onDate = (days.length - 1 - index) % showEvery === 0;
    const classes = ['bar-item'];
    if (mm === null) classes.push('is-empty');
    if (index === bestIndex) classes.push('is-best');
    return el(
      'li',
      { class: classes.join(' '), title: label },
      el(
        'div',
        { class: 'bar-track' },
        el('div', { class: 'bar', style: `height:${height}%` }),
        range === '7d' && mm !== null && el('span', {
          class: 'bar-value',
          style: `bottom:calc(${Math.min(height, 86)}% + 2px)`,
          'aria-hidden': 'true',
          text: fmt.decimal1.format(/** @type {number} */ (mmToKm(mm))),
        }),
      ),
      el('span', { class: onDate ? 'bar-date' : 'bar-date is-quiet', 'aria-hidden': 'true', text: dayText(day.date, fmt.dayNumeric) }),
      el('span', { class: 'sr-only', text: label }),
    );
  });
  $('bars').replaceChildren(...items);
}

/** @param {any[]} days @param {any} typicalDay */
function heatRows(days, typicalDay) {
  const blank = () => Array.from({ length: HEAT_SLOTS }, () => ({ work: null, partial: false }));
  const rows = [...days].reverse().map((day) => {
    const cells = blank();
    for (const bucket of Array.isArray(day.buckets) ? day.buckets : []) {
      const slot = bucket.startMinuteUtc / 30;
      const work = big(bucket.workUnits);
      if (Number.isInteger(slot) && slot >= 0 && slot < HEAT_SLOTS && work !== null) {
        cells[slot] = { work: Number(work), partial: bucket.coverage === 'partial' };
      }
    }
    return { label: dayText(day.date, fmt.dayNumeric), date: dayText(day.date, fmt.day), cells };
  });
  const typical = blank();
  for (const slotData of Array.isArray(typicalDay) ? typicalDay : []) {
    const slot = slotData.startMinuteUtc / 30;
    const mean = big(slotData.meanWorkMilli);
    if (Number.isInteger(slot) && slot >= 0 && slot < HEAT_SLOTS && mean !== null) {
      typical[slot] = { work: Number(mean) / 1000, partial: false };
    }
  }
  rows.push({ label: t('heatTypical'), date: t('heatTypical'), cells: typical });
  return rows;
}

function drawWheelHeat() {
  const canvas = $('heat-canvas');
  const width = canvas.parentElement.clientWidth;
  const rows = state.heatRows;
  if (!width || rows.length === 0) return;
  const days = rows.length - 1;
  state.heatLayout = drawHeatmap(canvas, rows, width, days > 10 ? 5 : 1);
  canvas.setAttribute('aria-label', t('heatAria', { days, time: state.heatPeak ?? t('unknown') }));
}

function renderHeatRead() {
  const pin = state.heatPinned;
  if (pin) {
    const row = state.heatRows[pin.row];
    const cell = row ? row.cells[pin.slot] : null;
    if (cell) {
      const time = slotLabel(pin.slot * 30);
      setText('heat-read', cell.work === null
        ? t('slotEmpty', { date: row.date, time })
        : t('slotRead', { date: row.date, time, work: fmt.small.format(cell.work) }));
      return;
    }
  }
  setText('heat-read', state.heatPeak ? t('heatPeak', { time: state.heatPeak }) : '');
}

/** @param {any} event */
function onHeatPointer(event) {
  const layout = state.heatLayout;
  if (!layout) return;
  const box = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - box.left - layout.gutter;
  const y = event.clientY - box.top;
  const slot = Math.floor(x / layout.cellW);
  if (slot < 0 || slot >= HEAT_SLOTS) return;
  let row = -1;
  if (y >= layout.typicalTop) row = layout.rowCount;
  else if (y >= layout.top) row = Math.min(layout.rowCount - 1, Math.floor((y - layout.top) / layout.cellH));
  if (row < 0) return;
  state.heatPinned = { row, slot };
  renderHeatRead();
}

/** @param {string} range */
function setWheelRange(range) {
  state.wheelRange = range;
  clearTimeout(feeds.stats.timer);
  feeds.stats.seq += 1;
  feeds.stats.error = null;
  safely('wheel', renderWheel);
  run(feeds.stats);
}

/* On-chain event stream */

/** @param {any} event */
function describeEvent(event) {
  const payload = event.payload || {};
  const key = `event_${String(event.type).replace(/\./g, '_')}`;
  if (!hasKey(key)) return String(event.type);
  const threshold = payload.thresholdDistanceMm;
  const date = payload.utcDate || payload.endingUtcDate;
  return t(key, {
    account: shortHash(payload.account),
    amount: sqkText(payload.amountBaseUnits),
    round: payload.throughRound ?? payload.settledThroughRound ?? '',
    blocks: payload.completedBlockCount ?? '',
    id: payload.tokenId ?? '',
    donor: payload.donorTokenId ?? '',
    survivor: payload.survivorTokenId ?? '',
    level: payload.level ?? '',
    km: threshold === undefined ? '' : kmText(threshold),
    days: payload.days ?? '',
    date: date ? dayText(date, fmt.day) : '',
  });
}

/** @param {any} event @param {boolean} isNew */
function eventNode(event, isNew) {
  const source = event.source || {};
  const url = txUrl(source.transactionHash);
  const classes = ['event', `cat-${eventGroup(event.type)}`];
  if (isNew) classes.push('is-new');
  return el(
    'li',
    { class: classes.join(' ') },
    el('span', { class: 'event-mark', 'aria-hidden': 'true' }),
    el(
      'div',
      {},
      el('p', { class: 'event-text', text: describeEvent(event) }),
      el(
        'p',
        { class: 'event-meta' },
        timeEl(event.occurredAt),
        url
          ? el('a', {
            href: url,
            target: '_blank',
            rel: 'noopener',
            title: t('txAria', { hash: source.transactionHash }),
            text: t('txLink', { hash: shortHash(source.transactionHash) }),
          })
          : el('span', { text: t('sensor') }),
      ),
    ),
  );
}

/** @param {any} data */
function mergeEvents(data) {
  state.eventsLoaded = true;
  if (data.status === 'unavailable') {
    state.eventsUnavailable = data;
    return;
  }
  state.eventsUnavailable = null;
  if (state.eventCursor === undefined) state.eventCursor = data.nextCursor ?? null;
  const first = state.eventIds.size === 0;
  const fresh = (Array.isArray(data.events) ? data.events : []).filter((event) => event && event.id && !state.eventIds.has(event.id));
  if (fresh.length === 0) return;
  for (const event of fresh) state.eventIds.add(event.id);
  state.events = fresh.concat(state.events);
  $('event-list').prepend(...fresh.map((event) => eventNode(event, !first)));
}

function renderEventState() {
  renderNotice('events-notice', feeds.events, state.eventsUnavailable);
  const empty = $('events-empty');
  const showEmpty = state.events.length === 0 && !(feeds.events.error && !state.eventsLoaded);
  empty.hidden = !showEmpty;
  if (showEmpty) empty.textContent = state.eventsLoaded ? t('eventsEmpty') : t('loading');
  $('event-older').hidden = !state.eventCursor;
  $('event-pause').textContent = state.paused ? t('resume') : t('pause');
}

function rebuildEvents() {
  $('event-list').replaceChildren(...state.events.map((event) => eventNode(event, false)));
  renderEventState();
}

/** @param {string} cat */
function setEventCat(cat) {
  state.eventCat = cat;
  state.events = [];
  state.eventIds = new Set();
  state.eventCursor = undefined;
  state.eventsLoaded = false;
  state.eventsUnavailable = null;
  feeds.events.error = null;
  feeds.events.seq += 1;
  clearTimeout(feeds.events.timer);
  setPressed($('event-cats'), 'data-cat', cat);
  rebuildEvents();
  // Choosing a category while paused shows that category's latest page once.
  if (state.paused) loadEventPage();
  else run(feeds.events);
}

function loadEventPage() {
  const seq = ++feeds.events.seq;
  getJson(`/events?category=${state.eventCat}&limit=30`)
    .then((data) => {
      if (seq !== feeds.events.seq) return;
      feeds.events.error = null;
      safely('events', () => mergeEvents(data));
    })
    .catch((error) => {
      if (seq === feeds.events.seq) feeds.events.error = error;
    })
    .finally(() => safely('events', renderEventState));
}

async function loadOlder() {
  const button = $('event-older');
  const cat = state.eventCat;
  const cursor = state.eventCursor;
  if (!cursor) return;
  button.disabled = true;
  try {
    const data = await getJson(`/events?category=${cat}&limit=30&cursor=${encodeURIComponent(cursor)}`);
    if (cat !== state.eventCat) return;
    state.eventCursor = data.nextCursor ?? null;
    const older = (Array.isArray(data.events) ? data.events : []).filter((event) => event && event.id && !state.eventIds.has(event.id));
    for (const event of older) state.eventIds.add(event.id);
    state.events = state.events.concat(older);
    $('event-list').append(...older.map((event) => eventNode(event, false)));
    feeds.events.error = null;
  } catch (error) {
    feeds.events.error = error;
  } finally {
    button.disabled = false;
    safely('events', renderEventState);
  }
}

function togglePause() {
  state.paused = !state.paused;
  renderEventState();
  if (state.paused) {
    clearTimeout(feeds.events.timer);
    feeds.events.timer = null;
    feeds.events.seq += 1;
  } else {
    run(feeds.events);
  }
}

/* OBS overlay kit */

function currentOverlayUrl() {
  return overlayUrl(location.href, state.lang, state.kitPanels);
}

function renderKit() {
  const url = currentOverlayUrl();
  $('overlay-link').value = url;
  $('open-overlay').href = url;
}

let copyTimer = null;

/** @param {string} message */
function sayCopy(message) {
  const node = $('copy-status');
  node.textContent = message;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { node.textContent = ''; }, 5000);
}

async function copyOverlay() {
  const url = currentOverlayUrl();
  try {
    await navigator.clipboard.writeText(url);
    sayCopy(t('copied'));
  } catch {
    const input = $('overlay-link');
    input.focus();
    input.select();
    let done = false;
    try {
      done = document.execCommand('copy');
    } catch {
      done = false;
    }
    sayCopy(done ? t('copied') : t('copyFailed'));
  }
}

function applyOverlayPanels() {
  for (const name of PANELS) {
    if (!params.panels.includes(name)) $(name).hidden = true;
  }
  // No pointer reaches an OBS source, so the mint range rotates by itself.
  if (params.panels.includes('mint')) {
    setInterval(() => {
      const next = MINT_CYCLE[(MINT_CYCLE.indexOf(state.mintRange) + 1) % MINT_CYCLE.length];
      setMintRange(next);
    }, 20000);
  }
}

/* Language */

function applyStaticText() {
  document.documentElement.lang = localeOf(state.lang);
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.getAttribute('data-i18n'));
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria')));
  }
}

function renderAll() {
  safely('core', renderCore);
  safely('blocks', renderBlocks);
  safely('mint', renderMint);
  safely('supply', renderSupply);
  safely('wheel', renderWheel);
  safely('events', rebuildEvents);
  safely('kit', renderKit);
  renderStatus();
}

/** @param {string} lang */
function setLanguage(lang) {
  state.lang = lang;
  fmt = buildFormatters(lang);
  state.blockSig = null;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
  applyStaticText();
  renderAll();
}

/* Live ticking */

function tick() {
  if (document.hidden) return;
  for (const node of document.querySelectorAll('time[data-rel]')) {
    const text = relativeText(Number(node.getAttribute('data-rel')));
    if (node.textContent !== text) node.textContent = text;
  }
  safely('next round', renderNextRound);
  renderStatus();
}

/* Startup */

function savedLanguage() {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

function bindControls() {
  const select = $('lang');
  select.replaceChildren(...LANGS.map((entry) => el('option', { value: entry.code, text: entry.name })));
  select.value = state.lang;
  select.addEventListener('change', () => setLanguage(select.value));

  $('copy-overlay').addEventListener('click', copyOverlay);
  $('overlay-link').addEventListener('focus', (event) => event.target.select());
  for (const box of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('input[name="panel"]'))) {
    box.addEventListener('change', () => {
      if (box.checked) state.kitPanels.add(box.value);
      else state.kitPanels.delete(box.value);
      renderKit();
    });
  }

  $('mint-ranges').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-range]');
    if (button) setMintRange(button.dataset.range);
  });
  $('wheel-ranges').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-range]');
    if (button) setWheelRange(button.dataset.range);
  });
  $('event-cats').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-cat]');
    if (button) setEventCat(button.dataset.cat);
  });
  $('event-pause').addEventListener('click', togglePause);
  $('event-older').addEventListener('click', loadOlder);

  const eggs = $('egg-canvas');
  eggs.addEventListener('pointermove', onEggPointer);
  eggs.addEventListener('pointerdown', onEggPointer);
  const heat = $('heat-canvas');
  heat.addEventListener('pointermove', onHeatPointer);
  heat.addEventListener('pointerdown', onHeatPointer);

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      safely('eggs', drawMintEggs);
      safely('heat', drawWheelHeat);
      safely('vault', () => {
        const supply = state.economy ? state.economy.supply : null;
        drawSupplyVault(supply ? fraction(supply.liveSupplyBaseUnits, supply.capBaseUnits) : null);
      });
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) Object.values(feeds).forEach(run);
  });
}

function start() {
  state.lang = pickLang(params.lang, savedLanguage(), navigator.languages || [navigator.language]);
  fmt = buildFormatters(state.lang);
  drawHen($('hen'));
  bindControls();
  applyStaticText();
  if (state.overlay) applyOverlayPanels();
  if (state.overlay) {
    $('nexus').hidden = false;
    import('./nexus.js').then(({ createNexus }) => {
      nexus = createNexus(() => ({
        core: state.core, coreAt: state.coreAt, error: feeds.core.error,
        lang: state.lang, locale: localeOf(state.lang), t,
      }));
      nexus.sync();
    }).catch((error) => {
      $('nexus-fallback').hidden = false;
      console.error('SqueekPulse: Nexus failed', error);
    });
  }
  renderAll();
  Object.values(feeds).forEach(run);
  setInterval(tick, 1000);
}

start();
