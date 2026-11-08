import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { SceneElement, SceneFiles, Viewport } from '../model/types';
import { boundsIntersect, getElementBounds } from '../math/geometry';
import { GRID_SIZE } from '../model/elements';
import { drawElement } from './draw';
import { pruneShapeCache } from './shapes';

const roughByCanvas = new WeakMap<HTMLCanvasElement, RoughCanvas>();

export function roughFor(canvas: HTMLCanvasElement): RoughCanvas {
  let rc = roughByCanvas.get(canvas);
  if (!rc) {
    rc = rough.canvas(canvas);
    roughByCanvas.set(canvas, rc);
  }
  return rc;
}

export interface SceneParams {
  elements: readonly SceneElement[];
  files: SceneFiles;
  viewport: Viewport;
  width: number;
  height: number;
  dpr: number;
  grid: boolean;
  dark: boolean;
  hideTextOf: string | null;
  erasing: ReadonlySet<string>;
}

function drawGrid(ctx: CanvasRenderingContext2D, p: SceneParams) {
  const { zoom, scrollX, scrollY } = p.viewport;
  const step = zoom < 0.4 ? GRID_SIZE * 5 : GRID_SIZE;
  const x0 = Math.floor(-scrollX / step) * step;
  const y0 = Math.floor(-scrollY / step) * step;
  const x1 = p.width / zoom - scrollX;
  const y1 = p.height / zoom - scrollY;
  ctx.lineWidth = 1 / zoom;
  ctx.strokeStyle = 'rgba(22,36,63,.09)';
  ctx.beginPath();
  for (let x = x0; x <= x1; x += step) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  for (let y = y0; y <= y1; y += step) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
}

export function renderScene(canvas: HTMLCanvasElement, p: SceneParams): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { zoom, scrollX, scrollY } = p.viewport;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = p.dpr * zoom;
  ctx.setTransform(scale, 0, 0, scale, scale * scrollX, scale * scrollY);

  if (p.grid) drawGrid(ctx, p);

  const view = {
    minX: -scrollX - 64 / zoom,
    minY: -scrollY - 64 / zoom,
    maxX: p.width / zoom - scrollX + 64 / zoom,
    maxY: p.height / zoom - scrollY + 64 / zoom,
  };
  const rc = roughFor(canvas);
  for (const el of p.elements) {
    if (!boundsIntersect(getElementBounds(el), view)) continue;
    drawElement(ctx, rc, el, {
      files: p.files,
      hideTextOf: p.hideTextOf,
      counterInvertImages: p.dark,
      fade: p.erasing.has(el.id),
    });
  }
  pruneShapeCache(p.elements.length);
}
