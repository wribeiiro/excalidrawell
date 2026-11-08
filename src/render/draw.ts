import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { SceneElement, SceneFiles, ShapeElement } from '../model/types';
import { isLinear, isShape } from '../model/types';
import { getImage } from './images';
import { getDrawables, getFreedrawPath } from './shapes';
import { fontString, labelWidth, LINE_HEIGHT, wrapLines } from './text';

export interface DrawOptions {
  files: SceneFiles;
  /** Elemento em edição: o texto dele é mostrado pelo editor, não pelo canvas. */
  hideTextOf: string | null;
  /** Reverte a inversão CSS do tema escuro nas imagens. */
  counterInvertImages: boolean;
  fade: boolean;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  el: Extract<SceneElement, { fontSize: number }>,
  width: number,
  top: number,
) {
  ctx.font = fontString(el.fontSize, el.fontFamily);
  ctx.fillStyle = el.strokeColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = el.textAlign;
  const x = el.textAlign === 'left' ? 0 : el.textAlign === 'center' ? width / 2 : width;
  const lh = el.fontSize * LINE_HEIGHT;
  lines.forEach((line, i) => ctx.fillText(line, x, top + lh * (i + 0.5)));
}

function drawLabel(ctx: CanvasRenderingContext2D, el: ShapeElement) {
  const inner = labelWidth(el);
  const lines = wrapLines(el.label, el.fontSize, el.fontFamily, inner);
  const total = lines.length * el.fontSize * LINE_HEIGHT;
  ctx.save();
  ctx.translate((el.width - inner) / 2, 0);
  drawLines(ctx, lines, el, inner, (el.height - total) / 2);
  ctx.restore();
}

export function drawElement(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  el: SceneElement,
  options: DrawOptions,
): void {
  ctx.save();
  ctx.globalAlpha = (el.opacity / 100) * (options.fade ? 0.3 : 1);
  if (isLinear(el)) {
    ctx.translate(el.x, el.y);
  } else {
    ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
    ctx.rotate(el.angle);
    ctx.translate(-el.width / 2, -el.height / 2);
  }

  if (el.type === 'freedraw') {
    const path = getFreedrawPath(el);
    if (path) {
      ctx.fillStyle = el.strokeColor;
      ctx.fill(path);
    }
  } else if (el.type === 'text') {
    if (options.hideTextOf !== el.id) drawLines(ctx, el.text.split('\n'), el, el.width, 0);
  } else if (el.type === 'image') {
    const image = getImage(el.fileId, options.files);
    if (image) {
      if (options.counterInvertImages) ctx.filter = 'invert(100%) hue-rotate(180deg)';
      ctx.translate(el.flipX ? el.width : 0, el.flipY ? el.height : 0);
      ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
      ctx.drawImage(image, 0, 0, el.width, el.height);
    } else {
      ctx.fillStyle = 'rgba(120,130,150,.2)';
      ctx.fillRect(0, 0, el.width, el.height);
    }
  } else {
    for (const drawable of getDrawables(el)) rc.draw(drawable);
    if (isShape(el) && el.label && options.hideTextOf !== el.id) drawLabel(ctx, el);
  }
  ctx.restore();
}
