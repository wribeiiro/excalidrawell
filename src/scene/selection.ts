import type { Point, SceneElement } from '../model/types';
import { isLinear } from '../model/types';
import { rotate, getCommonBounds } from '../math/geometry';
import type { Handle } from './transform';

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
}

export const getSelected = (elements: readonly SceneElement[], ids: ReadonlySet<string>) =>
  elements.filter((el) => ids.has(el.id));

/** Inclui todos os membros dos grupos dos elementos informados. */
export function expandGroups(
  elements: readonly SceneElement[],
  ids: Iterable<string>,
): Set<string> {
  const out = new Set(ids);
  const groups = new Set<string>();
  for (const el of elements) if (out.has(el.id) && el.groupId) groups.add(el.groupId);
  for (const el of elements) if (el.groupId && groups.has(el.groupId)) out.add(el.id);
  return out;
}

/** Moldura da seleção; `null` para uma única linha/seta, que usa alças por ponto. */
export function getSelectionFrame(selected: readonly SceneElement[]): Frame | null {
  if (selected.length === 0) return null;
  if (selected.length === 1) {
    const el = selected[0];
    if (isLinear(el)) return null;
    return { x: el.x, y: el.y, width: el.width, height: el.height, angle: el.angle };
  }
  const b = getCommonBounds(selected);
  if (!b) return null;
  return { x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY, angle: 0 };
}

export type HandleName = Handle | 'rotate';

export function getHandles(
  frame: Frame,
  zoom: number,
): { name: HandleName; point: Point }[] {
  const pad = 4 / zoom;
  const x0 = frame.x - pad;
  const y0 = frame.y - pad;
  const x1 = frame.x + frame.width + pad;
  const y1 = frame.y + frame.height + pad;
  const mx = (x0 + x1) / 2;
  const c: Point = [frame.x + frame.width / 2, frame.y + frame.height / 2];
  const list: { name: HandleName; point: Point }[] = [
    { name: 'nw', point: [x0, y0] },
    { name: 'ne', point: [x1, y0] },
    { name: 'se', point: [x1, y1] },
    { name: 'sw', point: [x0, y1] },
  ];
  list.push({ name: 'rotate', point: [mx, y0 - 16 / zoom] });
  return list.map((h) => ({ ...h, point: rotate(h.point, c, frame.angle) }));
}

/** Lado da moldura sob o ponteiro: as bordas inteiras redimensionam, sem alças visíveis. */
export function edgeHandleAt(
  frame: Frame,
  p: Point,
  zoom: number,
  selected: readonly SceneElement[],
): Handle | null {
  if (selected.some((el) => el.type === 'text')) return null;
  const c: Point = [frame.x + frame.width / 2, frame.y + frame.height / 2];
  const [x, y] = rotate(p, c, -frame.angle);
  // A faixa fica por fora do contorno, para clicar na borda da forma continuar movendo.
  const inner = 2 / zoom;
  const outer = 12 / zoom;
  const dx = Math.abs(x - c[0]) - frame.width / 2;
  const dy = Math.abs(y - c[1]) - frame.height / 2;
  const inBandX = dx >= inner && dx <= outer;
  const inBandY = dy >= inner && dy <= outer;
  if (inBandY && dx <= outer) return y < c[1] ? 'n' : 's';
  if (inBandX && dy <= outer) return x < c[0] ? 'w' : 'e';
  return null;
}

const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
const ORDER: Handle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export function handleCursor(handle: HandleName, angle: number): string {
  if (handle === 'rotate') return 'grab';
  const steps = Math.round(angle / (Math.PI / 4));
  const index = (((ORDER.indexOf(handle) + steps) % 8) + 8) % 8;
  return CURSORS[index % 4];
}

export function midpoints(points: Point[]): Point[] {
  return points.slice(0, -1).map((p, i) => [(p[0] + points[i + 1][0]) / 2, (p[1] + points[i + 1][1]) / 2]);
}
