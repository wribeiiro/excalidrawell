import { absolutePoints, withAbsolutePoints } from '../model/elements';
import type { FreedrawPoint, Point, SceneElement } from '../model/types';
import { isLinear } from '../model/types';
import type { Bounds } from '../math/geometry';
import { getCenter, getCommonBounds, rotate } from '../math/geometry';

export type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface ResizeOptions {
  keepAspect: boolean;
  fromCenter: boolean;
}

const MIN_SIZE = 1;

function applyScale(start: SceneElement, width: number, height: number, sx: number, sy: number) {
  if (start.type === 'freedraw') {
    const points = start.points.map(([x, y, p]): FreedrawPoint => [
      sx < 0 ? width + x * sx : x * sx,
      sy < 0 ? height + y * sy : y * sy,
      p,
    ]);
    return { ...start, width, height, points };
  }
  if (start.type === 'image') {
    return {
      ...start,
      width,
      height,
      flipX: sx < 0 ? !start.flipX : start.flipX,
      flipY: sy < 0 ? !start.flipY : start.flipY,
    };
  }
  if (start.type === 'text') {
    return { ...start, width, height, fontSize: Math.max(4, start.fontSize * Math.abs(sx)) };
  }
  return { ...start, width, height };
}

/** Redimensiona um elemento de caixa respeitando a rotação e permitindo inverter. */
export function resizeElement(
  start: SceneElement,
  handle: Handle,
  pointer: Point,
  options: ResizeOptions,
): SceneElement {
  const keepAspect = options.keepAspect || start.type === 'text';
  const c = getCenter(start);
  const [px, py] = rotate(pointer, c, -start.angle);
  const w = Math.max(start.width, MIN_SIZE);
  const h = Math.max(start.height, MIN_SIZE);
  const moveW = handle.includes('w');
  const moveE = handle.includes('e');
  const moveN = handle.includes('n');
  const moveS = handle.includes('s');

  let nw = w;
  let nh = h;
  if (moveE) nw = options.fromCenter ? (px - c[0]) * 2 : px - start.x;
  if (moveW) nw = options.fromCenter ? (c[0] - px) * 2 : start.x + w - px;
  if (moveS) nh = options.fromCenter ? (py - c[1]) * 2 : py - start.y;
  if (moveN) nh = options.fromCenter ? (c[1] - py) * 2 : start.y + h - py;

  const horizontal = moveW || moveE;
  const vertical = moveN || moveS;
  if (keepAspect) {
    if (horizontal && vertical) {
      const scale = Math.max(Math.abs(nw) / w, Math.abs(nh) / h);
      nw = (nw < 0 ? -1 : 1) * w * scale;
      nh = (nh < 0 ? -1 : 1) * h * scale;
    } else if (horizontal) {
      nh = h * (Math.abs(nw) / w);
    } else {
      nw = w * (Math.abs(nh) / h);
    }
  }
  if (Math.abs(nw) < MIN_SIZE) nw = MIN_SIZE;
  if (Math.abs(nh) < MIN_SIZE) nh = MIN_SIZE;

  let centerX = c[0];
  let centerY = c[1];
  if (!options.fromCenter) {
    if (moveE) centerX = start.x + nw / 2;
    if (moveW) centerX = start.x + w - nw / 2;
    if (moveS) centerY = start.y + nh / 2;
    if (moveN) centerY = start.y + h - nh / 2;
  }

  const [wx, wy] = rotate([centerX, centerY], c, start.angle);
  const width = Math.abs(nw);
  const height = Math.abs(nh);
  const scaled = applyScale(start, width, height, nw / w, nh / h);
  return { ...scaled, x: wx - width / 2, y: wy - height / 2 } as SceneElement;
}

/** Redimensiona vários elementos proporcionalmente à caixa comum. Não inverte. */
export function resizeElements(
  starts: readonly SceneElement[],
  handle: Handle,
  pointer: Point,
  keepAspectRequested: boolean,
): SceneElement[] {
  const b = getCommonBounds(starts) as Bounds;
  const width = Math.max(b.maxX - b.minX, MIN_SIZE);
  const height = Math.max(b.maxY - b.minY, MIN_SIZE);
  const moveW = handle.includes('w');
  const moveE = handle.includes('e');
  const moveN = handle.includes('n');
  const moveS = handle.includes('s');
  const anchorX = moveW ? b.maxX : b.minX;
  const anchorY = moveN ? b.maxY : b.minY;
  const keepAspect =
    keepAspectRequested || starts.some((el) => el.angle !== 0 || el.type === 'text');

  let sx = moveE ? (pointer[0] - b.minX) / width : moveW ? (b.maxX - pointer[0]) / width : 1;
  let sy = moveS ? (pointer[1] - b.minY) / height : moveN ? (b.maxY - pointer[1]) / height : 1;
  sx = Math.max(sx, 0.02);
  sy = Math.max(sy, 0.02);
  if (keepAspect) {
    const horizontal = moveW || moveE;
    const vertical = moveN || moveS;
    const s = horizontal && vertical ? Math.max(sx, sy) : horizontal ? sx : sy;
    sx = s;
    sy = s;
  }

  const scaleX = (x: number) => anchorX + (x - anchorX) * sx;
  const scaleY = (y: number) => anchorY + (y - anchorY) * sy;

  return starts.map((el) => {
    if (isLinear(el)) {
      return withAbsolutePoints(
        el,
        absolutePoints(el).map(([x, y]) => [scaleX(x), scaleY(y)]),
      );
    }
    const c = getCenter(el);
    const nw = el.width * sx;
    const nh = el.height * sy;
    const scaled = applyScale(el, nw, nh, sx, sy);
    return { ...scaled, x: scaleX(c[0]) - nw / 2, y: scaleY(c[1]) - nh / 2 } as SceneElement;
  });
}

export function rotateElements(
  starts: readonly SceneElement[],
  pivot: Point,
  delta: number,
): SceneElement[] {
  return starts.map((el) => {
    if (isLinear(el)) {
      return withAbsolutePoints(
        el,
        absolutePoints(el).map((p) => rotate(p, pivot, delta)),
      );
    }
    const [cx, cy] = rotate(getCenter(el), pivot, delta);
    const tau = Math.PI * 2;
    return {
      ...el,
      x: cx - el.width / 2,
      y: cy - el.height / 2,
      angle: (((el.angle + delta) % tau) + tau) % tau,
    };
  });
}
