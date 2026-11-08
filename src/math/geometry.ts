import type { Point, SceneElement } from '../model/types';
import { isLinear } from '../model/types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function rotate([x, y]: Point, [cx, cy]: Point, angle: number): Point {
  if (angle === 0) return [x, y];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

export const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  if (len === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Curva Catmull-Rom com a mesma tensão padrão do `curve` do roughjs. */
export function flattenCurve(points: Point[], steps = 12): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      out.push([
        a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0],
        a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1],
      ]);
    }
  }
  return out;
}

export function linearLocalBounds(points: Point[]): Bounds {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function getCenter(el: SceneElement): Point {
  if (isLinear(el)) {
    const b = linearLocalBounds(el.points);
    return [el.x + (b.minX + b.maxX) / 2, el.y + (b.minY + b.maxY) / 2];
  }
  return [el.x + el.width / 2, el.y + el.height / 2];
}

export function getElementBounds(el: SceneElement): Bounds {
  if (isLinear(el)) {
    const pts = el.roundness === 'round' ? flattenCurve(el.points, 6) : el.points;
    const b = linearLocalBounds(pts);
    return {
      minX: el.x + b.minX,
      minY: el.y + b.minY,
      maxX: el.x + b.maxX,
      maxY: el.y + b.maxY,
    };
  }
  const c = getCenter(el);
  const corners = (
    [
      [el.x, el.y],
      [el.x + el.width, el.y],
      [el.x + el.width, el.y + el.height],
      [el.x, el.y + el.height],
    ] as Point[]
  ).map((p) => rotate(p, c, el.angle));
  return {
    minX: Math.min(...corners.map((p) => p[0])),
    minY: Math.min(...corners.map((p) => p[1])),
    maxX: Math.max(...corners.map((p) => p[0])),
    maxY: Math.max(...corners.map((p) => p[1])),
  };
}

export function getCommonBounds(elements: readonly SceneElement[]): Bounds | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
}

export const boundsIntersect = (a: Bounds, b: Bounds) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

export const boundsContain = (outer: Bounds, inner: Bounds) =>
  outer.minX <= inner.minX &&
  outer.minY <= inner.minY &&
  outer.maxX >= inner.maxX &&
  outer.maxY >= inner.maxY;

/** Trava o ângulo do vetor origem→alvo em múltiplos de 15°. */
export function snapAngle(origin: Point, target: Point): Point {
  const step = Math.PI / 12;
  const angle = Math.round(Math.atan2(target[1] - origin[1], target[0] - origin[0]) / step) * step;
  const len = distance(origin, target);
  return [origin[0] + Math.cos(angle) * len, origin[1] + Math.sin(angle) * len];
}
