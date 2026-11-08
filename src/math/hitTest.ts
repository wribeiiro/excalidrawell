import type { Point, SceneElement } from '../model/types';
import { isLinear, isShape } from '../model/types';
import { distanceToSegment, flattenCurve, getCenter, rotate } from './geometry';

const hasFill = (el: SceneElement) => el.backgroundColor !== 'transparent';

function hitPolyline(points: Point[], p: Point, threshold: number): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(p, points[i], points[i + 1]) <= threshold) return true;
  }
  return false;
}

/** `p` em coordenadas do mundo; `threshold` em unidades do mundo. */
export function hitElement(el: SceneElement, p: Point, threshold: number): boolean {
  const t = threshold + el.strokeWidth / 2;

  if (isLinear(el)) {
    const local: Point = [p[0] - el.x, p[1] - el.y];
    const pts = el.roundness === 'round' ? flattenCurve(el.points) : el.points;
    return hitPolyline(pts, local, t);
  }

  const c = getCenter(el);
  const [lx, ly] = rotate(p, c, -el.angle);
  const x = lx - el.x;
  const y = ly - el.y;
  const inBox = x >= -t && y >= -t && x <= el.width + t && y <= el.height + t;

  if (el.type === 'text' || el.type === 'image') return inBox;
  if (el.type === 'freedraw') {
    if (!inBox) return false;
    return hitPolyline(
      el.points.map((q): Point => [q[0], q[1]]),
      [x, y],
      t + el.strokeWidth * 2,
    );
  }

  if (!inBox || !isShape(el)) return false;
  const inside = hasFill(el) || el.label.trim() !== '';
  const a = el.width / 2;
  const b = el.height / 2;

  if (el.type === 'rectangle') {
    if (inside) return true;
    return (
      Math.min(Math.abs(x), Math.abs(x - el.width), Math.abs(y), Math.abs(y - el.height)) <= t
    );
  }
  if (el.type === 'diamond') {
    const verts: Point[] = [
      [a, 0],
      [el.width, b],
      [a, el.height],
      [0, b],
      [a, 0],
    ];
    if (inside && Math.abs(x - a) / Math.max(a, 1) + Math.abs(y - b) / Math.max(b, 1) <= 1) {
      return true;
    }
    return hitPolyline(verts, [x, y], t);
  }
  const nx = (x - a) / Math.max(a, 1);
  const ny = (y - b) / Math.max(b, 1);
  const r = Math.hypot(nx, ny);
  if (inside && r <= 1) return true;
  return Math.abs(r - 1) * Math.min(a, b) <= t;
}

export function getElementAt(
  elements: readonly SceneElement[],
  p: Point,
  zoom: number,
  includeLocked = false,
): SceneElement | null {
  const threshold = 6 / zoom;
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.locked && !includeLocked) continue;
    if (hitElement(el, p, threshold)) return el;
  }
  return null;
}
