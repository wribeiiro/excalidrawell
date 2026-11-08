import { absolutePoints, withAbsolutePoints } from '../model/elements';
import type { LinearElement, Point, SceneElement } from '../model/types';
import { isBindable, isLinear } from '../model/types';
import { getCenter, rotate } from '../math/geometry';

const GAP = 6;

/** Métrica radial: <= 1 está dentro do contorno de semieixos (a, b). */
function radial(el: SceneElement, dx: number, dy: number, a: number, b: number): number {
  const x = Math.abs(dx) / Math.max(a, 1);
  const y = Math.abs(dy) / Math.max(b, 1);
  if (el.type === 'ellipse') return Math.hypot(x, y);
  if (el.type === 'diamond') return x + y;
  return Math.max(x, y);
}

export function findBindable(
  elements: readonly SceneElement[],
  p: Point,
  excludeId: string | null,
  zoom: number,
): SceneElement | null {
  const margin = 12 / zoom;
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.id === excludeId || el.locked || !isBindable(el)) continue;
    const c = getCenter(el);
    const [lx, ly] = rotate(p, c, -el.angle);
    const m = radial(el, lx - c[0], ly - c[1], el.width / 2 + margin, el.height / 2 + margin);
    if (m <= 1) return el;
  }
  return null;
}

/** Ponto na borda de `el`, afastado por um respiro, na direção de `toward`. */
export function anchorPoint(el: SceneElement, toward: Point): Point {
  const c = getCenter(el);
  const [lx, ly] = rotate(toward, c, -el.angle);
  let dx = lx - c[0];
  let dy = ly - c[1];
  if (dx === 0 && dy === 0) dx = 1;
  const a = el.width / 2 + GAP;
  const b = el.height / 2 + GAP;
  const t = 1 / radial(el, dx, dy, a, b);
  dx *= t;
  dy *= t;
  return rotate([c[0] + dx, c[1] + dy], c, el.angle);
}

function rebind(arrow: LinearElement, byId: Map<string, SceneElement>): LinearElement {
  const start = arrow.startBinding ? byId.get(arrow.startBinding) : undefined;
  const end = arrow.endBinding ? byId.get(arrow.endBinding) : undefined;
  const staleStart = arrow.startBinding !== null && !start;
  const staleEnd = arrow.endBinding !== null && !end;
  if (!start && !end) {
    return staleStart || staleEnd ? { ...arrow, startBinding: null, endBinding: null } : arrow;
  }

  const abs = absolutePoints(arrow);
  const last = abs.length - 1;
  const towardStart: Point = last > 1 ? abs[1] : end ? getCenter(end) : abs[last];
  const towardEnd: Point = last > 1 ? abs[last - 1] : start ? getCenter(start) : abs[0];
  if (start) abs[0] = anchorPoint(start, towardStart);
  if (end) abs[last] = anchorPoint(end, towardEnd);

  return {
    ...withAbsolutePoints(arrow, abs),
    startBinding: start ? arrow.startBinding : null,
    endBinding: end ? arrow.endBinding : null,
  };
}

/** Reposiciona setas ligadas às formas de `changedIds` (ou todas, se omitido). */
export function updateBindings(
  elements: SceneElement[],
  changedIds?: ReadonlySet<string>,
): SceneElement[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  let changed = false;
  const next = elements.map((el) => {
    if (!isLinear(el) || (el.startBinding === null && el.endBinding === null)) return el;
    const touched =
      !changedIds ||
      changedIds.has(el.id) ||
      (el.startBinding !== null && changedIds.has(el.startBinding)) ||
      (el.endBinding !== null && changedIds.has(el.endBinding));
    if (!touched) return el;
    const updated = rebind(el, byId);
    if (updated !== el) changed = true;
    return updated;
  });
  return changed ? next : elements;
}
