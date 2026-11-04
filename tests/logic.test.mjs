// Run with `npm test`. Covers the pure helpers and translation completeness; no browser needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANGS, STRINGS, hasKey, pickLang, translate } from '../src/assets/i18n.js';
import {
  MOSAIC_COLS, MOSAIC_ROWS, PANELS, big, eggDots, eventGroup, fraction, litDots, mmToKm, mosaicCells,
  overlayUrl, readParams, retryDelay, shortHash, slotLabel, sqkNumber, txUrl,
} from '../src/assets/logic.js';

const HASH = '0x29eeb5ef5189f1e0824adaeba2572eb1d84c9114e76fe3b416281c611b13af9e';

test('big keeps unknown values unknown', () => {
  assert.equal(big('12'), 12n);
  assert.equal(big(null), null);
  assert.equal(big(undefined), null);
  assert.equal(big(''), null);
  assert.equal(big('not a number'), null);
  assert.equal(sqkNumber(null), null);
  assert.equal(mmToKm(null), null);
});

test('base units convert to SQK and shares', () => {
  assert.equal(sqkNumber('171120627578553214560981'), 171120.6275);
  assert.equal(fraction('33547602104353572063931817', '2100000000000000000000000000'), 0.015975);
  assert.equal(fraction('1', '0'), null);
  assert.equal(mmToKm('9295386'), 9.295386);
});

test('transaction links only accept real hashes', () => {
  assert.equal(txUrl(HASH), `https://sepolia.etherscan.io/tx/${HASH}`);
  assert.equal(txUrl('0x1234'), null);
  assert.equal(txUrl('javascript:alert(1)'), null);
  assert.equal(txUrl(null), null);
  assert.equal(shortHash(HASH), '0x29ee…af9e');
});

test('mosaics are 13 by 24, mirrored and stable per hash', () => {
  const cells = mosaicCells(HASH, 43);
  assert.equal(cells.length, 13 * 24);
  assert.equal(MOSAIC_COLS * MOSAIC_ROWS, 312);
  assert.deepEqual(cells, mosaicCells(HASH, 43));
  assert.notDeepEqual(cells, mosaicCells(HASH.replace('29', '30'), 43));
  for (let row = 0; row < MOSAIC_ROWS; row++) {
    for (let col = 0; col < MOSAIC_COLS; col++) {
      assert.equal(cells[row * 13 + col], cells[row * 13 + (12 - col)]);
    }
  }
  const lit = (blocks) => mosaicCells(HASH, blocks).filter((level) => level > 0).length;
  assert.ok(lit(64) > lit(0));
});

test('egg dots fill from the bottom', () => {
  const small = eggDots(7, 9);
  assert.equal(small.length, 49);
  assert.equal(small[0].y, 8);
  assert.equal(small[small.length - 1].y, 0);
  const vault = eggDots(46, 59);
  assert.ok(vault.length > 1950 && vault.length < 2300, `vault has ${vault.length} dots`);
});

test('litDots shows any non-zero share and caps at the total', () => {
  assert.equal(litDots(0, 100), 0);
  assert.equal(litDots(0.0001, 100), 1);
  assert.equal(litDots(0.5, 100), 50);
  assert.equal(litDots(2, 100), 100);
});

test('overlay links round-trip through the URL', () => {
  const page = 'https://gateway.example/ipfs/abc/?x=1#mint';
  const all = new URL(overlayUrl(page, 'ko', PANELS));
  assert.equal(all.pathname, '/ipfs/abc/');
  assert.equal(all.hash, '');
  assert.equal(all.searchParams.get('overlay'), '1');
  assert.equal(all.searchParams.get('lang'), 'ko');
  assert.equal(all.searchParams.get('panels'), null);
  assert.equal(all.searchParams.get('x'), null);

  const some = overlayUrl(page, 'en', new Set(['events', 'mint']));
  const read = readParams(new URL(some).search);
  assert.equal(read.overlay, true);
  assert.deepEqual(read.panels, ['mint', 'events']);
  assert.equal(readParams('').overlay, false);
  assert.equal(readParams('?overlay=0').overlay, false);
  assert.deepEqual(readParams('').panels, PANELS);
  assert.equal(readParams('?wheel=30d').wheel, '30d');
  assert.equal(readParams('?wheel=nope').wheel, '7d');
});

test('backoff grows, caps and honours Retry-After', () => {
  assert.equal(retryDelay(1, 0, 15000), 15000);
  assert.equal(retryDelay(2, 0, 15000), 30000);
  assert.equal(retryDelay(20, 0, 15000), 300000);
  assert.equal(retryDelay(1, 120, 15000), 120000);
});

test('slots and event groups', () => {
  assert.equal(slotLabel(0), '00:00');
  assert.equal(slotLabel(1350), '22:30');
  assert.equal(eventGroup('system.settlement_completed'), 'protocol');
  assert.equal(eventGroup('nft.merged'), 'players');
  assert.equal(eventGroup('account.rewards_claimed'), 'players');
  assert.equal(eventGroup('measurement.speed_record'), 'measurement');
});

test('every language has every string and the same placeholders', () => {
  assert.equal(LANGS.length, 8);
  const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort().join();
  for (const { code } of LANGS) {
    const table = STRINGS[code];
    assert.ok(table, `missing language ${code}`);
    assert.deepEqual(Object.keys(table).sort(), Object.keys(STRINGS.en).sort(), `keys differ in ${code}`);
    for (const key of Object.keys(STRINGS.en)) {
      assert.equal(placeholders(table[key]), placeholders(STRINGS.en[key]), `${code}.${key}`);
    }
  }
});

test('language resolution prefers URL, then saved, then browser', () => {
  assert.equal(pickLang('ko', 'ru', ['es']), 'ko');
  assert.equal(pickLang('xx', 'ru', ['es']), 'ru');
  assert.equal(pickLang(null, null, ['es-MX', 'en']), 'es');
  assert.equal(pickLang(null, null, ['zh-TW']), 'zh');
  assert.equal(pickLang(null, null, ['fr']), 'en');
});

test('translate fills placeholders and falls back to English', () => {
  assert.equal(translate('en', 'cardBlock', { height: 8430 }), 'Block 8430');
  assert.equal(translate('xx', 'cardBlock', { height: 1 }), 'Block 1');
  assert.equal(hasKey('event_nft_merged'), true);
  assert.equal(hasKey('event_unknown'), false);
});
