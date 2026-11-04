// Small, deterministic 3D primitives; no WebGL, remote assets or runtime dependencies.
export const TAU = Math.PI * 2;

/** @param {number} value @param {number} low @param {number} high */
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** @typedef {{x:number,y:number}} Point */
/** @typedef {{x:number,y:number,z:number}} Point3 */

/** Fibonacci distribution avoids dense particle clusters at the poles. @param {number} count */
export function spherePoints(count) {
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    return { x: Math.cos(angle) * ring, y, z: Math.sin(angle) * ring };
  });
}

/** @param {Point3} point @param {number} yaw @param {number} pitch @returns {Point3} */
export function rotate(point, yaw, pitch) {
  const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const z = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  return { x, y: point.y * Math.cos(pitch) - z * Math.sin(pitch), z: point.y * Math.sin(pitch) + z * Math.cos(pitch) };
}

/** Perspective camera at z=5. @param {Point3} point @param {number} radius */
export function project(point, radius) {
  const scale = 5 / (5 - point.z);
  return { x: point.x * radius * scale, y: point.y * radius * scale, z: point.z, scale };
}

/** @param {Point[]} points @param {number} t @returns {Point} */
export function bezierPoint(points, t) {
  const [a, b, c, d] = points;
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y,
  };
}

/** Edges enter at the nearest face; five cards each receive their own curve.
 * @param {Point} center @param {number} radius @param {Point} target
 * @param {'left'|'right'|'bottom'} side @param {number} index @returns {Point[]}
 */
export function tetherCurve(center, radius, target, side, index) {
  const angle = Math.atan2(target.y - center.y, target.x - center.x);
  const start = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  if (side === 'bottom') {
    const spread = (index - 2) * radius * 0.09;
    return [start, { x: start.x + spread, y: start.y + Math.max(24, dy * 0.5) },
      { x: target.x, y: target.y - Math.max(24, dy * 0.3) }, target];
  }
  return [start, { x: start.x + dx * 0.52, y: start.y + dy * 0.06 },
    { x: target.x - dx * 0.35, y: target.y }, target];
}
