import { fraction, big } from './logic.js';
import { TAU, clamp, spherePoints, rotate, project, bezierPoint, tetherCurve } from './nexus-math.js';

const EMERALD = '#5dfba0';
const GOLD = '#ffd257';
const PARTICLES = spherePoints(960);
const WIRE = Array.from({ length: 17 }, (_, row) => Array.from({ length: 33 }, (_, col) => {
  const latitude = (row / 16) * Math.PI;
  const longitude = (col / 32) * TAU;
  return { x: Math.sin(latitude) * Math.cos(longitude), y: Math.cos(latitude), z: Math.sin(latitude) * Math.sin(longitude) };
}));

/** @typedef {{core:any,coreAt:number,error:any,lang:string,locale:string,t:(key:string,values?:any)=>string}} Telemetry */
/** @typedef {{id:string,curve:import('./nexus-math.js').Point[],gold:boolean,index:number}} Tether */

/** A real 3D point cloud and wire mesh, perspective-projected onto a transparent 2D Canvas.
 * The semantic HUD lives in the DOM; Canvas is entirely decorative and never contains live text.
 * @param {()=>Telemetry} read
 */
export function createNexus(read) {
  const host = /** @type {HTMLElement} */ (document.getElementById('main'));
  const stage = /** @type {HTMLElement} */ (document.getElementById('nexus-stage'));
  const orbit = /** @type {HTMLElement} */ (document.getElementById('nexus-orbit'));
  const motion = /** @type {HTMLButtonElement} */ (document.getElementById('nexus-motion'));
  const zoomIn = /** @type {HTMLButtonElement} */ (document.getElementById('nexus-zoom-in'));
  const zoomOut = /** @type {HTMLButtonElement} */ (document.getElementById('nexus-zoom-out'));
  const reset = /** @type {HTMLButtonElement} */ (document.getElementById('nexus-reset'));
  const canvas = document.createElement('canvas');
  canvas.id = 'nexus-canvas';
  canvas.className = 'nexus-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 1099px), (max-height: 699px)');
  let paused = false;
  let yaw = 0.4;
  let pitch = -0.2;
  let zoom = 1;
  let progress = null;
  let live = false;
  let frame = 0;
  let lastFrame = 0;
  let clock = 0;
  let layoutDirty = true;
  let width = 1;
  let height = 1;
  let center = { x: 0, y: 0 };
  let baseRadius = 1;
  let disposed = false;
  /** @type {{x:number,y:number,id:number}|null} */
  let drag = null;
  /** @type {Tether[]} */
  let tethers = [];
  const abort = new AbortController();
  const { signal } = abort;

  /** @param {string} id @param {string} value */
  function text(id, value) {
    const node = document.getElementById(id);
    if (node && node.textContent !== value) node.textContent = value;
  }

  function sync() {
    const data = read();
    const core = data.core?.status !== 'unavailable' ? data.core?.core : null;
    const share = core ? fraction(core.blockProgress, data.core?.configuration?.blockUnitsPerBlock) : null;
    progress = share === null ? null : clamp(share, 0, 1);
    const formatter = new Intl.NumberFormat(data.locale);
    const number = (value) => big(value) === null ? '-' : formatter.format(big(value));
    text('nexus-height', number(core?.blockHeight));
    text('nexus-round', number(core?.settledThroughRound));
    text('nexus-progress', progress === null ? '-' : new Intl.NumberFormat(data.locale, { style: 'percent', maximumFractionDigits: 1 }).format(progress));
    const stale = !!data.error || (!!data.coreAt && Date.now() - data.coreAt > 45000);
    live = !!core && !stale && !core.paused;
    const key = stale ? (core ? 'nexusStale' : 'nexusUnavailable') : core?.paused ? 'nexusCorePaused' : core ? 'nexusLive' : data.core ? 'nexusUnavailable' : 'nexusWaiting';
    text('nexus-feed-text', data.t(key));
    document.getElementById('nexus-feed').dataset.state = stale ? 'stale' : core?.paused ? 'paused' : core ? 'live' : 'connecting';
    text('nexus-connections', data.t('nexusConnections', { count: tethers.length }));
    updateControls();
    requestDraw();
  }

  function moving() { return !paused && !reduced.matches && !document.hidden && !disposed && !!ctx; }

  function updateControls() {
    const { t } = read();
    motion.textContent = t(reduced.matches ? 'nexusReduced' : paused ? 'nexusResume' : 'nexusPause');
    motion.setAttribute('aria-pressed', String(paused || reduced.matches));
    motion.disabled = reduced.matches || !ctx;
    canvas.dataset.motion = reduced.matches ? 'reduced' : paused ? 'paused' : 'running';
    zoomIn.disabled = zoom >= 1.2 || !ctx;
    zoomOut.disabled = zoom <= 0.75 || !ctx;
    reset.disabled = !ctx;
    orbit.dataset.zoom = zoom.toFixed(2);
    orbit.dataset.yaw = yaw.toFixed(3);
    orbit.dataset.pitch = pitch.toFixed(3);
  }

  function measure() {
    layoutDirty = false;
    const rect = host.getBoundingClientRect();
    const scene = stage.getBoundingClientRect();
    width = host.clientWidth;
    height = host.clientHeight;
    // Cap both density and total pixels, including the long scrolling mobile composition.
    const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8000000 / Math.max(1, width * height)));
    const w = Math.round(width * ratio), h = Math.round(height * ratio);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    center = { x: scene.left - rect.left + scene.width / 2, y: scene.top - rect.top + scene.height * 0.52 };
    baseRadius = Math.max(24, Math.min(scene.width * 0.31, scene.height * 0.31));
    const targets = [
      { id: 'mint', selector: '#mint', side: 'left', gold: true },
      { id: 'supply', selector: '#supply', side: 'left', gold: true },
      { id: 'telemetry', selector: '#hero .kpis', side: 'right', gold: false },
      { id: 'events', selector: '#events', side: 'right', gold: false },
      { id: 'wheel', selector: '#wheel', side: 'right', gold: false },
      ...Array.from({ length: 5 }, (_, i) => ({ id: `settlement-${i + 1}`, selector: `#block-list .block-card:nth-child(${i + 1})`, side: 'bottom', gold: false })),
    ];
    tethers = [];
    for (const [index, target] of targets.entries()) {
      const node = /** @type {HTMLElement|null} */ (host.querySelector(target.selector));
      if (!node || node.closest('[hidden]') || !node.getClientRects().length) continue;
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const side = /** @type {'bottom'|'left'|'right'} */ (narrow.matches ? (target.gold || index % 2 === 0 ? 'left' : 'right') : target.side);
      const end = {
        x: narrow.matches ? (side === 'left' ? box.left - rect.left : box.right - rect.left)
          : side === 'left' ? box.right - rect.left : side === 'right' ? box.left - rect.left : box.left - rect.left + box.width / 2,
        y: side === 'bottom' ? box.top - rect.top : box.top - rect.top + box.height * 0.5,
      };
      let curve = tetherCurve(center, baseRadius * 1.32, end, side, side === 'bottom' ? index - 5 : index);
      if (narrow.matches) {
        const direction = side === 'left' ? -1 : 1;
        const rail = side === 'left' ? 5 + (index % 3) * 3 : width - 5 - (index % 3) * 3;
        const start = { x: center.x + direction * baseRadius * 1.32, y: center.y + (index % 3 - 1) * baseRadius * 0.2 };
        curve = [start, { x: rail, y: start.y + 24 }, { x: rail, y: end.y }, end];
      }
      tethers.push({ id: target.id, curve, gold: target.gold, index });
    }
    canvas.dataset.connections = tethers.map((item) => item.id).join(',');
    text('nexus-connections', read().t('nexusConnections', { count: tethers.length }));
  }

  /** @param {import('./nexus-math.js').Point[]} curve */
  function curvePath(curve) {
    ctx.beginPath();
    ctx.moveTo(curve[0].x, curve[0].y);
    ctx.bezierCurveTo(curve[1].x, curve[1].y, curve[2].x, curve[2].y, curve[3].x, curve[3].y);
  }

  function drawTethers() {
    for (const tether of tethers) {
      const color = tether.gold ? GOLD : EMERALD;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.06;
      ctx.lineWidth = 7;
      curvePath(tether.curve); ctx.stroke();
      ctx.globalAlpha = live ? 0.42 : 0.2;
      ctx.lineWidth = 1;
      curvePath(tether.curve); ctx.stroke();
      ctx.fillStyle = color;
      const end = tether.curve[3];
      ctx.beginPath(); ctx.arc(end.x, end.y, 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(end.x, end.y, 8, 0, TAU); ctx.stroke();
      // Continuous packets are a visual treatment, not invented transaction counts.
      for (let i = 0; i < 3; i++) {
        let phase = (clock * 0.00012 + i / 3 + tether.index * 0.13) % 1;
        if (tether.gold) phase = 1 - phase;
        const point = bezierPoint(tether.curve, phase);
        const tail = bezierPoint(tether.curve, clamp(phase + (tether.gold ? 0.055 : -0.055), 0, 1));
        ctx.globalAlpha = live ? 0.8 : 0.32;
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        const gradient = ctx.createLinearGradient(tail.x, tail.y, point.x + 0.01, point.y + 0.01);
        gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, color);
        ctx.strokeStyle = gradient; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(point.x, point.y); ctx.stroke();
        ctx.fillStyle = '#edfff2';
        ctx.beginPath(); ctx.arc(point.x, point.y, 2, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = color;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    const radius = baseRadius * 1.32;
    ctx.strokeStyle = EMERALD;
    ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.beginPath(); ctx.arc(center.x, center.y, radius + 8, 0, TAU); ctx.stroke();
    for (let i = 0; i < 120; i++) {
      const angle = (i / 120) * TAU - Math.PI / 2;
      const major = i % 10 === 0;
      const filled = progress !== null && i / 120 < progress;
      ctx.strokeStyle = filled ? GOLD : EMERALD;
      ctx.globalAlpha = filled ? 0.7 : major ? 0.4 : 0.16;
      ctx.beginPath();
      ctx.moveTo(center.x + Math.cos(angle) * (radius + 12), center.y + Math.sin(angle) * (radius + 12));
      ctx.lineTo(center.x + Math.cos(angle) * (radius + (major ? 20 : 16)), center.y + Math.sin(angle) * (radius + (major ? 20 : 16)));
      ctx.stroke();
    }
    if (progress !== null && progress > 0) {
      ctx.globalAlpha = 0.9; ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10; ctx.shadowColor = GOLD;
      ctx.beginPath(); ctx.arc(center.x, center.y, radius, -Math.PI / 2, -Math.PI / 2 + TAU * progress); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // Four small datum marks ground the instrument without adding a card around it.
    ctx.strokeStyle = EMERALD; ctx.lineWidth = 1; ctx.globalAlpha = 0.35;
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const x = center.x + Math.cos(angle) * (radius + 31);
      const y = center.y + Math.sin(angle) * (radius + 31);
      ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSphere() {
    const radius = baseRadius * zoom;
    ctx.save();
    ctx.translate(center.x, center.y);
    const aura = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.5);
    aura.addColorStop(0, 'rgba(57,229,140,0.1)'); aura.addColorStop(0.6, 'rgba(57,229,140,0.07)'); aura.addColorStop(1, 'rgba(57,229,140,0)');
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, radius * 1.5, 0, TAU); ctx.fill();
    const globe = ctx.createRadialGradient(-radius * 0.32, -radius * 0.38, radius * 0.1, 0, 0, radius * 1.03);
    globe.addColorStop(0, 'rgba(15,65,43,0.95)'); globe.addColorStop(0.6, 'rgba(4,32,23,0.96)'); globe.addColorStop(1, 'rgba(3,15,12,0.98)');
    ctx.fillStyle = globe; ctx.beginPath(); ctx.arc(0, 0, radius * 1.022, 0, TAU); ctx.fill();
    const wire = WIRE.map((row) => row.map((point) => project(rotate(point, yaw, pitch), radius)));
    ctx.lineWidth = 0.7; ctx.strokeStyle = EMERALD;
    for (let row = 0; row < wire.length; row++) {
      for (let col = 0; col < wire[row].length; col++) {
        const a = wire[row][col];
        for (const b of [wire[row][col + 1], wire[row + 1]?.[col]]) {
          if (!b) continue;
          ctx.globalAlpha = (a.z + b.z) / 2 > 0 ? 0.3 : 0.065;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    // Depth sorting and perspective scaling make the particles turn through a 3D volume.
    const points = PARTICLES.map((point, i) => ({ ...project(rotate(point, yaw, pitch), radius), i })).sort((a, b) => a.z - b.z);
    for (const point of points) {
      const gold = point.i % 11 === 0 || (point.i % 29 < 3 && point.z > 0.1);
      ctx.globalAlpha = clamp((point.z + 1.4) / 2.5, 0.1, 1) * (gold ? 0.95 : 0.8);
      ctx.fillStyle = gold ? GOLD : EMERALD;
      const size = (gold ? 1.6 : 0.9) * point.scale * Math.max(0.65, radius / 190);
      if (gold && point.z > 0) { ctx.shadowColor = GOLD; ctx.shadowBlur = 6; }
      ctx.beginPath(); ctx.arc(point.x, point.y, size, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // A tilted equatorial orbit also uses 3D projection, passing in front and behind the globe.
    let previous = null;
    for (let i = 0; i <= 160; i++) {
      const angle = (i / 160) * TAU;
      const point = project(rotate({ x: Math.cos(angle) * 1.16, y: 0, z: Math.sin(angle) * 1.16 }, -0.55, 0.58), radius);
      if (previous) {
        ctx.strokeStyle = GOLD; ctx.globalAlpha = point.z > 0 ? 0.55 : 0.12; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.stroke();
      }
      previous = point;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** @param {number} now */
  function draw(now) {
    frame = 0;
    if (!ctx || disposed || document.hidden) { lastFrame = 0; return; }
    if (moving() && lastFrame && now - lastFrame < 1000 / 30) { frame = requestAnimationFrame(draw); return; }
    const elapsed = lastFrame ? Math.min(64, now - lastFrame) : 0;
    lastFrame = now;
    if (moving()) { clock += elapsed; if (!drag) yaw = (yaw + elapsed * 0.0001) % TAU; }
    if (layoutDirty) measure();
    ctx.clearRect(0, 0, width, height);
    drawTethers();
    drawHud();
    drawSphere();
    if (moving()) frame = requestAnimationFrame(draw);
  }

  function requestDraw() {
    if (!frame && !disposed && !document.hidden && ctx) frame = requestAnimationFrame(draw);
  }

  function invalidate() { layoutDirty = true; requestDraw(); }

  function toggleMotion() {
    if (reduced.matches || !ctx) return;
    paused = !paused;
    lastFrame = 0;
    updateControls(); requestDraw();
  }

  /** @param {number} delta */
  function changeZoom(delta) { zoom = clamp(Math.round((zoom + delta) * 100) / 100, 0.75, 1.2); updateControls(); requestDraw(); }
  function resetView() { yaw = 0.4; pitch = -0.2; zoom = 1; updateControls(); requestDraw(); }

  motion.addEventListener('click', toggleMotion, { signal });
  zoomIn.addEventListener('click', () => changeZoom(0.05), { signal });
  zoomOut.addEventListener('click', () => changeZoom(-0.05), { signal });
  reset.addEventListener('click', resetView, { signal });
  orbit.addEventListener('pointerdown', (event) => {
    if (!ctx || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
    orbit.setPointerCapture(event.pointerId);
  }, { signal });
  orbit.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    yaw += (event.clientX - drag.x) * 0.007;
    pitch = clamp(pitch + (event.clientY - drag.y) * 0.006, -1.2, 1.2);
    drag.x = event.clientX; drag.y = event.clientY;
    updateControls(); requestDraw();
  }, { signal });
  const endDrag = () => { drag = null; };
  orbit.addEventListener('pointerup', endDrag, { signal });
  orbit.addEventListener('pointercancel', endDrag, { signal });
  orbit.addEventListener('lostpointercapture', endDrag, { signal });
  orbit.addEventListener('wheel', (event) => {
    if (narrow.matches || event.ctrlKey || !ctx) return;
    event.preventDefault(); changeZoom(event.deltaY > 0 ? -0.05 : 0.05);
  }, { passive: false, signal });
  orbit.addEventListener('keydown', (event) => {
    if (!ctx || event.ctrlKey || event.metaKey || event.altKey) return;
    const actions = {
      ArrowLeft: () => { yaw -= 0.15; }, ArrowRight: () => { yaw += 0.15; },
      ArrowUp: () => { pitch = clamp(pitch - 0.12, -1.2, 1.2); }, ArrowDown: () => { pitch = clamp(pitch + 0.12, -1.2, 1.2); },
      '+': () => changeZoom(0.05), '=': () => changeZoom(0.05), '-': () => changeZoom(-0.05),
      Home: resetView, ' ': toggleMotion,
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); updateControls(); requestDraw(); }
  }, { signal });
  reduced.addEventListener('change', () => { lastFrame = 0; updateControls(); requestDraw(); }, { signal });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; lastFrame = 0;
    if (!document.hidden) { sync(); invalidate(); }
  }, { signal });
  window.addEventListener('resize', invalidate, { signal });
  const resizeObserver = new ResizeObserver(invalidate);
  resizeObserver.observe(host); resizeObserver.observe(stage);
  for (const node of host.querySelectorAll('section')) resizeObserver.observe(node);
  const blocksObserver = new MutationObserver(invalidate);
  blocksObserver.observe(document.getElementById('block-list'), { childList: true });
  const panelsObserver = new MutationObserver(invalidate);
  panelsObserver.observe(host, { attributes: true, attributeFilter: ['hidden'], subtree: true });
  const returnUrl = new URL(location.href);
  returnUrl.searchParams.delete('overlay'); returnUrl.searchParams.delete('panels');
  document.getElementById('nexus-return').setAttribute('href', returnUrl.href);
  if (!ctx) {
    document.getElementById('nexus-fallback').hidden = false;
    orbit.removeAttribute('tabindex');
  }
  sync(); invalidate();

  return {
    sync,
    destroy() {
      disposed = true; cancelAnimationFrame(frame); abort.abort();
      resizeObserver.disconnect(); blocksObserver.disconnect(); panelsObserver.disconnect(); canvas.remove();
    },
  };
}
