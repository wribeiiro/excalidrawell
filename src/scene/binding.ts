import { absolutePoints, withAbsolutePoints } from '../model/elements';
import type { LinearElement, Point, PointBinding, SceneElement } from '../model/types';
import { isBindable, isLinear, isShape } from '../model/types';
import { distance, distanceToSegment, getCenter, rotate } from '../math/geometry';

/*
 * Mesma regra das setas do Excalidraw: `focus` guarda por onde a seta passa em
 * relação ao centro da forma e `gap` a distância até o contorno. Quando a forma
 * muda, a ponta é recalculada a partir desses dois valores.
 */

const HIGHLIGHT_THICKNESS = 10;
const HIGHLIGHT_OFFSET = 4;

export type ArrowEnd = 'start' | 'end';

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];

export function maxBindingGap(el: SceneElement, zoom = 1): number {
  const ratio = el.type === 'diamond' ? 1 / Math.SQRT2 : 1;
  const smaller = ratio * Math.min(el.width, el.height);
  const zoomValue = zoom < 1 ? zoom : 1;
  return Math.max(16, Math.min(0.25 * smaller, 32), HIGHLIGHT_THICKNESS / zoomValue + HIGHLIGHT_OFFSET);
}

function ellipseDistance(px: number, py: number, a: number, b: number): number {
  let tx = Math.SQRT1_2;
  let ty = Math.SQRT1_2;
  for (let i = 0; i < 5; i++) {
    const x = a * tx;
    const y = b * ty;
    const ex = ((a * a - b * b) * tx ** 3) / a;
    const ey = ((b * b - a * a) * ty ** 3) / b;
    const r = Math.hypot(x - ex, y - ey);
    const q = Math.max(Math.hypot(px - ex, py - ey), 1e-6);
    tx = Math.min(1, Math.max(0, (((px - ex) * r) / q + ex) / a));
    ty = Math.min(1, Math.max(0, (((py - ey) * r) / q + ey) / b));
    const t = Math.max(Math.hypot(tx, ty), 1e-6);
    tx /= t;
    ty /= t;
  }
  return Math.hypot(px - a * tx, py - b * ty);
}

/** Canto arredondado é uma curva quadrática, como o desenho; (u, v) na escala do raio. */
function cornerDistance(u: number, v: number): number {
  let best = Infinity;
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    best = Math.min(best, Math.hypot(u - (2 * t - t * t), v - (1 - t * t)));
  }
  const outsideCurve = u >= 1 || v > 1 - (1 - Math.sqrt(1 - u)) ** 2;
  return outsideCurve ? best : -best;
}

/** Distância até o contorno: negativa por dentro, positiva por fora. */
export function signedDistance(el: SceneElement, p: Point): number {
  const c = getCenter(el);
  const local = rotate(p, c, -el.angle);
  const x = Math.abs(local[0] - c[0]);
  const y = Math.abs(local[1] - c[1]);
  const a = Math.max(el.width / 2, 0.5);
  const b = Math.max(el.height / 2, 0.5);

  if (el.type === 'ellipse') {
    const d = ellipseDistance(x, y, a, b);
    return (x / a) ** 2 + (y / b) ** 2 <= 1 ? -d : d;
  }
  if (el.type === 'diamond') {
    const d = distanceToSegment([x, y], [a, 0], [0, b]);
    return x / a + y / b <= 1 ? -d : d;
  }
  const r = el.type === 'rectangle' && el.roundness === 'round' ? Math.min(32, Math.min(a, b) * 0.5) : 0;
  const qx = x - (a - r);
  const qy = y - (b - r);
  if (r > 0 && qx > 0 && qy > 0) return cornerDistance(qx / r, qy / r) * r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Elemento cujo contorno está ao alcance do ponto. O miolo de formas grandes não conecta. */
export function findBindable(
  elements: readonly SceneElement[],
  p: Point,
  excludeId: string | null,
  zoom: number,
): SceneElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.id === excludeId || el.locked || !isBindable(el)) continue;
    if (Math.abs(signedDistance(el, p)) <= maxBindingGap(el, zoom)) return el;
  }
  return null;
}

/** Forma sob o ponto, incluindo o interior; usada para escrever dentro dela. */
export function findShapeAt(
  elements: readonly SceneElement[],
  p: Point,
  zoom: number,
): SceneElement | null {
  const margin = 12 / zoom;
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el.locked && isShape(el) && signedDistance(el, p) <= margin) return el;
  }
  return null;
}

function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const denominator = cross(r, s);
  if (denominator === 0) return null;
  const t = cross(sub(c, a), s) / denominator;
  const u = cross(sub(c, a), r) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [a[0] + t * r[0], a[1] + t * r[1]];
}

export function focusDistance(el: SceneElement, a: Point, b: Point): number {
  if (a[0] === b[0] && a[1] === b[1]) return 0;
  const c = getCenter(el);
  const ra = rotate(a, c, -el.angle);
  const rb = rotate(b, c, -el.angle);
  const sign = -Math.sign(cross(sub(rb, a), sub(rb, c)));
  const direction = sub(rb, ra);
  const length = Math.max(Math.hypot(direction[0], direction[1]), 1e-6);
  const reach = Math.max(el.width * 2, el.height * 2);
  const end: Point = [rb[0] + (direction[0] / length) * reach, rb[1] + (direction[1] / length) * reach];
  const { x, y, width: w, height: h } = el;

  const diamond = el.type === 'diamond';
  const axes: [Point, Point][] = diamond
    ? [
        [[x + w / 2, y - h], [x + w / 2, y + h * 2]],
        [[x - w, y + h / 2], [x + w * 2, y + h / 2]],
      ]
    : [
        [[x - w, y - h], [x + w * 2, y + h * 2]],
        [[x + w * 2, y - h], [x - w, y + h * 2]],
      ];
  const halves = diamond ? [h / 2, w / 2] : [Math.hypot(w, h) / 2, Math.hypot(w, h) / 2];

  const ratios = axes
    .map(([p, q]) => segmentIntersection(rb, end, p, q))
    .filter((point): point is Point => point !== null)
    .sort((g, h2) => distance(g, b) - distance(h2, b))
    .map((point, index) => (sign * distance(c, point)) / Math.max(halves[index], 1e-6))
    .sort((g, h2) => Math.abs(g) - Math.abs(h2));
  return ratios[0] ?? 0;
}

export function focusPoint(el: SceneElement, focus: number, adjacent: Point): Point {
  const c = getCenter(el);
  if (focus === 0) return c;
  const { x, y, width: w, height: h } = el;
  const corners: Point[] =
    el.type === 'diamond'
      ? [[x, y + h / 2], [x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h]]
      : [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const candidates = corners
    .map((p): Point => [c[0] + (p[0] - c[0]) * Math.abs(focus), c[1] + (p[1] - c[1]) * Math.abs(focus)])
    .map((p) => rotate(p, c, el.angle));
  const side = (i: number) => {
    const from = candidates[i];
    const to = candidates[(i + 1) % 4];
    return cross(sub(adjacent, from), sub(to, from));
  };
  for (let i = 0; i < 3; i++) {
    const other = focus > 0 ? (i + 1) % 4 : (i + 3) % 4;
    if (side(i) > 0 && side(other) < 0) return candidates[focus > 0 ? i + 1 : i];
  }
  return candidates[focus > 0 ? 0 : 3];
}

/** Cruzamentos do segmento com o contorno afastado por `gap`, do mais próximo de `from`. */
function outlineCrossings(el: SceneElement, from: Point, to: Point, gap: number): Point[] {
  const steps = Math.min(600, Math.max(8, Math.ceil(distance(from, to) / 3)));
  const at = (t: number): Point => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  const f = (t: number) => signedDistance(el, at(t)) - gap;
  const hits: Point[] = [];
  let previous = f(0);
  for (let i = 1; i <= steps; i++) {
    const current = f(i / steps);
    if (previous > 0 !== current > 0) {
      let low = (i - 1) / steps;
      let high = i / steps;
      const lowPositive = previous > 0;
      for (let k = 0; k < 24; k++) {
        const middle = (low + high) / 2;
        if (f(middle) > 0 === lowPositive) low = middle;
        else high = middle;
      }
      hits.push(at((low + high) / 2));
    }
    previous = current;
  }
  return hits;
}

function boundPoint(el: SceneElement, binding: PointBinding, adjacent: Point, edge: Point): Point {
  const aim = focusPoint(el, binding.focus, adjacent);
  const c = getCenter(el);
  const direction = sub(aim, adjacent);
  const length = Math.hypot(direction[0], direction[1]);
  if (length === 0) return edge;
  const reach = distance(adjacent, edge) + distance(adjacent, c) + Math.max(el.width, el.height) * 2;
  const far: Point = [adjacent[0] + (direction[0] / length) * reach, adjacent[1] + (direction[1] / length) * reach];
  const hits = outlineCrossings(el, adjacent, far, binding.gap);
  if (hits.length > 1) return hits[0];
  return hits.length === 1 ? aim : edge;
}

/** Calcula a ligação de uma ponta da seta na posição em que ela está. */
export function createBinding(arrow: LinearElement, target: SceneElement, end: ArrowEnd): PointBinding {
  const abs = absolutePoints(arrow);
  const edge = end === 'start' ? abs[0] : abs[abs.length - 1];
  const adjacent = end === 'start' ? abs[1] : abs[abs.length - 2];
  const measured = Math.max(1, Math.abs(signedDistance(target, edge)));
  return {
    elementId: target.id,
    focus: focusDistance(target, adjacent, edge),
    gap: measured > maxBindingGap(target) ? HIGHLIGHT_THICKNESS + HIGHLIGHT_OFFSET : measured,
  };
}

/** Seta de dois pontos não liga as duas pontas à mesma forma. */
export function bindsOppositeEnd(arrow: LinearElement, target: SceneElement, end: ArrowEnd): boolean {
  const other = end === 'start' ? arrow.endBinding : arrow.startBinding;
  return arrow.points.length < 3 && other?.elementId === target.id;
}

function rebind(
  arrow: LinearElement,
  byId: Map<string, SceneElement>,
  changedIds: ReadonlySet<string> | undefined,
): LinearElement {
  const start = arrow.startBinding ? byId.get(arrow.startBinding.elementId) : undefined;
  const end = arrow.endBinding ? byId.get(arrow.endBinding.elementId) : undefined;
  const startBinding = start ? arrow.startBinding : null;
  const endBinding = end ? arrow.endBinding : null;
  const stale = startBinding !== arrow.startBinding || endBinding !== arrow.endBinding;
  const clean = stale ? { ...arrow, startBinding, endBinding } : arrow;
  if (!changedIds) return clean;

  const simple = arrow.points.length < 3;
  const moved = (el: SceneElement | undefined) => !!el && changedIds.has(el.id);
  if (!moved(start) && !moved(end)) return clean;

  const before = absolutePoints(arrow);
  const abs = [...before];
  const last = abs.length - 1;
  if (start && startBinding && (simple || moved(start))) {
    abs[0] = boundPoint(start, startBinding, before[1], before[0]);
  }
  if (end && endBinding && (simple || moved(end))) {
    abs[last] = boundPoint(end, endBinding, before[last - 1], before[last]);
  }
  return withAbsolutePoints(clean, abs);
}

/**
 * Reposiciona as setas ligadas às formas de `changedIds`. Sem `changedIds`,
 * apenas remove ligações cujo destino não existe mais.
 */
export function updateBindings(
  elements: SceneElement[],
  changedIds?: ReadonlySet<string>,
): SceneElement[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  let changed = false;
  const next = elements.map((el) => {
    if (!isLinear(el) || (el.startBinding === null && el.endBinding === null)) return el;
    const updated = rebind(el, byId, changedIds);
    if (updated !== el) changed = true;
    return updated;
  });
  return changed ? next : elements;
}
