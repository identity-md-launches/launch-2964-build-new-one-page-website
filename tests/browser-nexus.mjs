// Bounded production-export integration checks. API responses are a public capture from
// 2026-11-04, served only by Playwright interception; fixtures never enter src/ or dist/.
// Set IMD_PLAYWRIGHT to an installed Playwright index.mjs. No npm dependencies are installed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { STRINGS, localeOf } from '../src/assets/i18n.js';

if (!process.env.IMD_PLAYWRIGHT) throw new Error('Set IMD_PLAYWRIGHT to an installed Playwright index.mjs.');
const { chromium, webkit } = await import(pathToFileURL(process.env.IMD_PLAYWRIGHT).href);
const fixtures = JSON.parse(await readFile(new URL('./fixtures/telemetry.json', import.meta.url), 'utf8'));
const root = resolve('dist');
const out = resolve('test/scratch/nexus-validation');
await mkdir(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (!pathname.startsWith('/preview/')) throw Error('not a preview path');
    const file = resolve(root, pathname.slice('/preview/'.length) || 'index.html');
    if (!file.startsWith(root + '/')) throw Error('outside export');
    response.setHeader('content-type', mime[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}/preview/`;
const checks = [];
const limits = [];
let browser;
function ok(name) { checks.push(name); console.log(`PASS ${name}`); }
const wait = (page, ms = 180) => page.waitForTimeout(ms);
const json = (page, code) => page.evaluate(code);
async function overflow(page) {
  assert.equal(await json(page, () => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow');
}
async function channels(page, count) {
  await page.waitForFunction((n) => (document.querySelector('#nexus-canvas')?.dataset.connections || '').split(',').filter(Boolean).length === n, count);
}
async function refresh(page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  const errors = [];
  const missing = [];
  const requests = [];
  let mode = 'ok';
  let delayCore = false;
  let core = structuredClone(fixtures.core);
  let settlements = structuredClone(fixtures.settlements);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (r) => { if (r.url().startsWith(origin) && r.status() >= 400) missing.push(r.url()); });
  await page.route('https://api.squeekchain.com/v1/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    const key = url.pathname.endsWith('/core') ? 'core' : url.pathname.endsWith('/settlements') ? 'settlements' : url.pathname.endsWith('/state') ? 'economy' : url.pathname.endsWith('/stats') ? 'stats' : 'events';
    if (key === 'core' && delayCore) await wait(page, 500);
    if (mode === 'fail' && key === 'core') return route.fulfill({ status: 503, body: 'Test-only outage' });
    let data = structuredClone(key === 'core' ? core : key === 'settlements' ? settlements : fixtures[key]);
    if (key === 'core' && mode === 'unavailable') data = { schemaVersion: 1, status: 'unavailable', reason: 'Test-only unavailable response' };
    if (key === 'core' && mode === 'malformed') return route.fulfill({ contentType: 'application/json', body: '{}' });
    if (url.searchParams.has('range')) data.range = url.searchParams.get('range');
    if (key === 'events' && url.searchParams.get('category') !== 'all') {
      const category = url.searchParams.get('category');
      data.events = data.events.filter((e) => category === 'protocol' ? e.type.startsWith('system.') : category === 'measurement' ? e.type.startsWith('measurement.') : !e.type.startsWith('system.') && !e.type.startsWith('measurement.'));
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(origin + '?overlay=1&lang=en');
  await channels(page, 10);
  await page.waitForFunction(() => document.querySelector('#nexus-feed').dataset.state === 'live');
  const height = new Intl.NumberFormat('en').format(BigInt(core.core.blockHeight));
  assert.equal(await page.locator('#nexus-height').textContent(), height);
  assert.equal(await page.locator('#nexus-round').textContent(), new Intl.NumberFormat('en').format(BigInt(core.core.settledThroughRound)));
  assert.equal(await page.locator('#nexus-progress').textContent(), '47.9%');
  assert.equal(await page.locator('#block-list .block-card:visible').count(), 5);
  ok('API-derived HUD and ten distinct panel/card connections');

  const image = () => page.evaluate(() => document.querySelector('#nexus-canvas').toDataURL());
  const first = await image(); await wait(page, 250); assert.notEqual(await image(), first);
  await page.locator('#nexus-motion').click();
  await page.waitForFunction(() => document.querySelector('#nexus-canvas').dataset.motion === 'paused');
  await wait(page);
  const frozen = await image(); await wait(page, 250); assert.equal(await image(), frozen);
  assert.equal(await page.locator('#nexus-motion').getAttribute('aria-pressed'), 'true');
  ok('rotating particles and flowing packets animate; pause freezes the complete Canvas');

  const orbit = page.locator('#nexus-orbit');
  const bounds = await orbit.boundingBox();
  const yaw = await orbit.getAttribute('data-yaw');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2 + 20, { steps: 5 }); await page.mouse.up();
  assert.notEqual(await orbit.getAttribute('data-yaw'), yaw);
  await orbit.focus();
  const previous = await orbit.getAttribute('data-yaw');
  await page.keyboard.press('ArrowLeft'); assert.notEqual(await orbit.getAttribute('data-yaw'), previous);
  await page.keyboard.press('+'); assert.equal(await orbit.getAttribute('data-zoom'), '1.05');
  const shortcutYaw = await orbit.getAttribute('data-yaw');
  await page.keyboard.press('Control+ArrowRight'); assert.equal(await orbit.getAttribute('data-yaw'), shortcutYaw);
  await orbit.dispatchEvent('keydown', { key: '+', ctrlKey: true });
  assert.equal(await orbit.getAttribute('data-zoom'), '1.05', 'browser zoom shortcut must not zoom the sphere');
  await page.keyboard.press('Home'); assert.equal(await orbit.getAttribute('data-zoom'), '1.00');
  assert.equal(await orbit.getAttribute('data-yaw'), '0.400');
  await page.keyboard.press('Tab'); assert.equal(await page.locator('#nexus-motion').evaluate((e) => e === document.activeElement), true);
  assert.equal(await page.locator('#nexus-motion').evaluate((e) => getComputedStyle(e).outlineStyle), 'solid');
  while (!await page.locator('#nexus-zoom-in').isDisabled()) await page.locator('#nexus-zoom-in').click();
  assert.equal(await orbit.getAttribute('data-zoom'), '1.20');
  assert.equal(await page.locator('#nexus-zoom-in').isDisabled(), true);
  await page.locator('#nexus-reset').click();
  ok('pointer drag, keyboard rotation/zoom/reset, natural tab order, focus and zoom bounds');

  core.core.blockHeight = '8431'; core.core.blockProgress = '750000000';
  await refresh(page);
  await page.waitForFunction(() => document.querySelector('#nexus-height').textContent === '8,431');
  assert.equal(await page.locator('#nexus-progress').textContent(), '75%');
  assert.equal(await page.locator('#nexus-canvas').getAttribute('data-motion'), 'paused');
  mode = 'fail'; await refresh(page);
  await page.waitForFunction(() => document.querySelector('#nexus-feed').dataset.state === 'stale');
  assert.equal(await page.locator('#nexus-height').textContent(), '8,431');
  mode = 'ok'; await page.locator('#hero-notice button').click();
  await page.waitForFunction(() => document.querySelector('#nexus-feed').dataset.state === 'live');
  mode = 'unavailable'; await refresh(page);
  await page.waitForFunction(() => document.querySelector('#nexus-height').textContent === '-');
  assert.equal(await page.locator('#nexus-progress').textContent(), '-');
  mode = 'ok'; await refresh(page);
  await page.waitForFunction(() => document.querySelector('#nexus-feed').dataset.state === 'live');
  core.core.paused = true; await refresh(page);
  await page.waitForFunction(() => document.querySelector('#nexus-feed').dataset.state === 'paused');
  core.core.paused = false; mode = 'malformed'; await refresh(page);
  await page.waitForFunction(() => document.querySelector('#nexus-feed').dataset.state === 'stale');
  mode = 'ok'; await refresh(page);
  await page.waitForFunction(() => document.querySelector('#nexus-feed').dataset.state === 'live');
  ok('live HUD updates while animation is paused; HTTP error, retry, unavailable, core-paused and malformed states');

  settlements.recentSettlements = settlements.recentSettlements.slice(0, 2);
  await refresh(page); await channels(page, 7);
  settlements = structuredClone(fixtures.settlements);
  await refresh(page); await channels(page, 10);
  ok('settlement replacement updates tether endpoints with no orphan paths');

  for (const [width, vh] of [[1920,1080],[1440,900],[1100,700],[1024,768],[390,844],[320,812]]) {
    await page.setViewportSize({ width, height: vh }); await wait(page, 250); await overflow(page);
    assert.equal(await page.locator('#nexus-title').isVisible(), true);
    await page.screenshot({ path: `${out}/overlay-${width}.png`, fullPage: false });
    if (width === 390) {
      const control = await page.locator('#nexus-motion').boundingBox();
      assert.ok(control.y + control.height < vh, 'main sphere action below first screen');
      for (const id of ['nexus-motion','nexus-zoom-in','nexus-zoom-out','nexus-reset']) {
        const box = await page.locator('#'+id).boundingBox(); assert.ok(box.height >= 44 && box.width >= 44);
      }
      await page.keyboard.press('Tab'); await orbit.focus(); await page.screenshot({ path: `${out}/overlay-390-focus.png` });
    }
  }
  ok('no horizontal overflow at 320/390/1024/1100/1440/1920; product and 44px controls on first phone screen');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#nexus-canvas').dataset.motion === 'reduced');
  await wait(page);
  const still = await image(); await wait(page, 250); assert.equal(await image(), still);
  assert.equal(await page.locator('#nexus-motion').isDisabled(), true);
  assert.equal(await page.locator('#nexus-motion').textContent(), 'Reduced motion');
  await orbit.focus(); await page.keyboard.press('ArrowRight');
  assert.notEqual(await image(), still);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  ok('reduced motion freezes all automatic Canvas motion while explicit keyboard exploration still works');

  await page.goto(origin+'?overlay=1&panels=mint,supply&lang=en');
  await channels(page, 3);
  assert.equal(await page.locator('#events').isVisible(), false);
  assert.equal(await page.locator('#nexus-canvas').getAttribute('data-connections'), 'mint,supply,telemetry');
  await page.goto(origin+'?overlay=1&panels=&lang=en'); await channels(page, 1);
  ok('panel URL selections connect only visible panels; empty selection retains telemetry');

  await page.setViewportSize({ width: 390, height: 844 });
  const savedCore = structuredClone(core);
  core.core.blockHeight = '18446744073709551615';
  core.core.settledThroughRound = '18446744073709551615';
  core.core.blockProgress = '99999999999999999999';
  await page.goto(origin+'?overlay=1&lang=en'); await channels(page, 10);
  await page.waitForFunction(() => document.querySelector('#nexus-height').textContent.includes('18,446,744'));
  await overflow(page);
  assert.equal(await page.locator('#nexus-progress').textContent(), '100%');
  const clips = await page.locator('.nexus-metric dd').evaluateAll((nodes) => nodes.some((n) => n.scrollWidth > n.clientWidth + 1));
  assert.equal(clips, false);
  await page.screenshot({ path: `${out}/overlay-390-long-values.png` });
  core = savedCore;
  ok('64-bit height/round values wrap without clipping; out-of-range progress is bounded to the HUD ring');

  for (const lang of Object.keys(STRINGS)) {
    await page.goto(origin+`?overlay=1&lang=${lang}`); await channels(page, 10);
    await page.waitForFunction(() => document.querySelector('#nexus-feed').dataset.state === 'live');
    await overflow(page);
    assert.equal(await page.locator('#nexus-motion').textContent(), STRINGS[lang].nexusPause);
    assert.equal(await orbit.getAttribute('aria-label'), STRINGS[lang].nexusOrbit);
    assert.equal(await page.locator('html').getAttribute('lang'), localeOf(lang));
    const box = await page.locator('#nexus-motion').boundingBox(); assert.ok(box.y + box.height < 844);
    if (lang === 'ru' || lang === 'zh') await page.screenshot({ path: `${out}/overlay-390-${lang}.png` });
  }
  ok('all eight locales retain named controls, localized HUD and first-screen motion action');

  await page.goto(origin+'?overlay=1&lang=en'); await channels(page, 10);
  await page.locator('#nexus-return').click();
  assert.equal(new URL(page.url()).searchParams.has('overlay'), false);
  assert.equal(await page.locator('#nexus').isVisible(), false);
  assert.equal(await page.locator('#nexus-canvas').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'live');
  await overflow(page);
  assert.ok((await page.locator('#copy-overlay').boundingBox()).y < 844);
  await page.screenshot({ path: `${out}/console-390.png` });
  await page.locator('#lang').selectOption('es');
  assert.equal(await page.locator('html').getAttribute('lang'), 'es');
  await page.locator('#lang').selectOption('en');
  await page.locator('#mint-ranges button[data-range="24h"]').click();
  await page.waitForFunction(() => document.querySelector('#mint-ranges button[data-range="24h"]').getAttribute('aria-pressed') === 'true');
  await page.locator('#wheel-ranges button[data-range="30d"]').click();
  assert.equal(await page.locator('#wheel-ranges button[data-range="30d"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#event-pause').click(); assert.equal(await page.locator('#event-pause').textContent(), STRINGS.en.resume);
  await page.locator('#event-cats button[data-cat="players"]').click();
  assert.equal(await page.locator('#event-cats button[data-cat="players"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#event-pause').click();
  await page.locator('input[name="panel"][value="wheel"]').uncheck();
  const link = new URL(await page.locator('#overlay-link').inputValue());
  assert.ok(!link.searchParams.get('panels').includes('wheel'));
  await page.locator('#copy-overlay').click();
  await page.waitForFunction((label) => document.querySelector('#copy-status').textContent === label, STRINGS.en.copied);
  assert.equal(await page.locator('#copy-status').textContent(), STRINGS.en.copied);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link.href);
  ok('normal console regression: overlay return, language, mint/wheel ranges, event filter/pause, panel selection and clipboard');

  const fallbackContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const fallback = await fallbackContext.newPage();
  await fallback.route('https://api.squeekchain.com/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    const key = p.endsWith('/core')?'core':p.endsWith('/settlements')?'settlements':p.endsWith('/state')?'economy':p.endsWith('/stats')?'stats':'events';
    await route.fulfill({ contentType:'application/json', body:JSON.stringify(fixtures[key]) });
  });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) { return this.id === 'nexus-canvas' ? null : original.apply(this,args); };
  });
  await fallback.goto(origin+'?overlay=1&lang=en');
  await fallback.waitForFunction(() => document.querySelector('#nexus-height').textContent !== '-');
  assert.equal(await fallback.locator('#nexus-fallback').isVisible(), true);
  assert.equal(await fallback.locator('#nexus-motion').isDisabled(), true);
  await fallbackContext.close();
  ok('Canvas failure preserves semantic live HUD and explains the unavailable renderer');

  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  ok('no uncaught JavaScript errors or missing local assets under a static subpath');
  await context.close();
  // Safari is optional evidence: try the provided runtime, without installing another browser.
  let safari;
  try { safari = await webkit.launch({ headless: true }); }
  catch { limits.push('WebKit runtime unavailable; no Safari or physical iPhone observation claimed.'); }
  if (safari) {
    try {
      const p = await safari.newPage({viewport:{width:390,height:844}});
      await p.route('https://api.squeekchain.com/**',r=>r.fulfill({status:503,body:'Test-only outage'}));
      await p.goto(origin+'?overlay=1&lang=en');
      await p.waitForSelector('#nexus-canvas');
      await p.locator('#nexus-motion').click();
      await p.locator('#nexus-orbit').focus(); await p.keyboard.press('ArrowLeft');
      await overflow(p); ok('WebKit phone layout and pause/keyboard interaction');
    } finally { await safari.close(); }
  }
  await writeFile(`${out}/results.json`, JSON.stringify({ checks, limits, api: 'Captured public responses with deterministic fault injection; no fixture is shipped to the page.' }, null, 2)+'\n');
  console.log(JSON.stringify({ passed: checks.length, limits }));
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
