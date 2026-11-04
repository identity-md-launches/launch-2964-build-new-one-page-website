import test from 'node:test';
import assert from 'node:assert/strict';
import { spherePoints, rotate, project, bezierPoint, tetherCurve, clamp } from '../src/assets/nexus-math.js';

test('particle distribution stays on the unit sphere with no duplicated poles', () => {
  const points = spherePoints(960);
  assert.equal(points.length, 960);
  for (const p of points) assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-12);
  assert.equal(new Set(points.map((p) => p.y)).size, points.length);
});

test('3D rotation preserves radius and turns front and back through the camera', () => {
  const p = { x: 0, y: 0, z: 1 };
  const turned = rotate(p, Math.PI / 2, 0);
  assert.ok(Math.abs(turned.x - 1) < 1e-12);
  assert.ok(Math.abs(turned.z) < 1e-12);
  for (let i = 0; i < 100; i++) {
    const q = rotate(p, i * 0.37, i * 0.27);
    assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z) - 1) < 1e-12);
  }
  assert.ok(project({ x: 0.5, y: 0, z: 0.8 }, 100).x > project({ x: 0.5, y: 0, z: -0.8 }, 100).x);
});

test('all five settlement routes reach distinct card centers and stay finite', () => {
  const center = { x: 500, y: 300 };
  const routes = Array.from({ length: 5 }, (_, i) => tetherCurve(center, 120, { x: 100 + i * 200, y: 800 }, 'bottom', i));
  for (const [i, curve] of routes.entries()) {
    assert.deepEqual(bezierPoint(curve, 0), curve[0]);
    assert.deepEqual(bezierPoint(curve, 1), { x: 100 + i * 200, y: 800 });
    for (let t = 0; t <= 1; t += 0.01) {
      const p = bezierPoint(curve, t);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  }
  assert.equal(new Set(routes.map((curve) => JSON.stringify(curve))).size, 5);
});

test('panel paths start on the HUD ring and meet the requested face exactly', () => {
  const center = { x: 500, y: 300 };
  for (const [side, target] of [['left', { x: 100, y: 100 }], ['right', { x: 900, y: 600 }]]) {
    const curve = tetherCurve(center, 120, target, side, 0);
    assert.ok(Math.abs(Math.hypot(curve[0].x - 500, curve[0].y - 300) - 120) < 1e-10);
    assert.deepEqual(bezierPoint(curve, 1), target);
  }
  assert.equal(clamp(-20, 0.75, 1.2), 0.75);
  assert.equal(clamp(20, 0.75, 1.2), 1.2);
});
