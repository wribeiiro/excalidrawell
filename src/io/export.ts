import atkinsonUrl from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url';
import monoUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';
import kalamUrl from '@fontsource/kalam/files/kalam-latin-400-normal.woff2?url';
import rough from 'roughjs';
import type { FontFamily, SceneElement, SceneFiles, ShapeElement } from '../model/types';
import { isLinear, isShape } from '../model/types';
import { getCenter, getCommonBounds } from '../math/geometry';
import { drawElement } from '../render/draw';
import { ensureImages } from '../render/images';
import { freedrawPathData, getDrawables } from '../render/shapes';
import { FONT_STACKS, labelWidth, LINE_HEIGHT, wrapLines } from '../render/text';

export interface ExportOptions {
  background: boolean;
  scale: number;
}

const PADDING = 24;
const BACKGROUND = '#ffffff';
const SVG_NS = 'http://www.w3.org/2000/svg';

export async function exportToCanvas(
  elements: readonly SceneElement[],
  files: SceneFiles,
  { background, scale }: ExportOptions,
): Promise<HTMLCanvasElement> {
  await ensureImages(elements, files);
  const b = getCommonBounds(elements);
  const canvas = document.createElement('canvas');
  if (!b) return canvas;
  canvas.width = Math.ceil((b.maxX - b.minX + PADDING * 2) * scale);
  canvas.height = Math.ceil((b.maxY - b.minY + PADDING * 2) * scale);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  if (background) {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(scale, scale);
  ctx.translate(PADDING - b.minX, PADDING - b.minY);
  const rc = rough.canvas(canvas);
  for (const el of elements) {
    drawElement(ctx, rc, el, { files, hideTextOf: null, counterInvertImages: false, fade: false });
  }
  return canvas;
}

export const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png'),
  );

const FONT_URLS: Record<FontFamily, [string, string]> = {
  hand: ['Kalam', kalamUrl],
  sans: ['Atkinson Hyperlegible', atkinsonUrl],
  mono: ['JetBrains Mono', monoUrl],
};

async function fontFaceCss(family: FontFamily): Promise<string> {
  const [name, url] = FONT_URLS[family];
  const blob = await (await fetch(url)).blob();
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  return `@font-face{font-family:"${name}";src:url(${dataUrl}) format("woff2");}`;
}

function svgText(
  parent: Element,
  lines: string[],
  el: Extract<SceneElement, { fontSize: number }>,
  width: number,
  offsetX: number,
  top: number,
) {
  const lh = el.fontSize * LINE_HEIGHT;
  const anchor = { left: 'start', center: 'middle', right: 'end' }[el.textAlign];
  const x = offsetX + (el.textAlign === 'left' ? 0 : el.textAlign === 'center' ? width / 2 : width);
  lines.forEach((line, i) => {
    const node = document.createElementNS(SVG_NS, 'text');
    node.setAttribute('x', String(x));
    node.setAttribute('y', String(top + lh * (i + 0.5)));
    node.setAttribute('fill', el.strokeColor);
    node.setAttribute('font-size', String(el.fontSize));
    node.setAttribute('font-family', FONT_STACKS[el.fontFamily]);
    node.setAttribute('text-anchor', anchor);
    node.setAttribute('dominant-baseline', 'central');
    node.setAttribute('xml:space', 'preserve');
    node.textContent = line;
    parent.appendChild(node);
  });
}

function svgLabel(parent: Element, el: ShapeElement) {
  const inner = labelWidth(el);
  const lines = wrapLines(el.label, el.fontSize, el.fontFamily, inner);
  const total = lines.length * el.fontSize * LINE_HEIGHT;
  svgText(parent, lines, el, inner, (el.width - inner) / 2, (el.height - total) / 2);
}

export async function exportToSvg(
  elements: readonly SceneElement[],
  files: SceneFiles,
  { background }: ExportOptions,
): Promise<string> {
  const b = getCommonBounds(elements);
  const svg = document.createElementNS(SVG_NS, 'svg');
  if (!b) return new XMLSerializer().serializeToString(svg);
  const width = b.maxX - b.minX + PADDING * 2;
  const height = b.maxY - b.minY + PADDING * 2;
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const families = new Set<FontFamily>();
  for (const el of elements) {
    if (el.type === 'text' || (isShape(el) && el.label)) families.add(el.fontFamily);
  }
  if (families.size > 0) {
    const style = document.createElementNS(SVG_NS, 'style');
    style.textContent = (await Promise.all([...families].map(fontFaceCss))).join('');
    svg.appendChild(style);
  }
  if (background) {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', BACKGROUND);
    svg.appendChild(rect);
  }

  const rc = rough.svg(svg);
  const shiftX = PADDING - b.minX;
  const shiftY = PADDING - b.minY;
  for (const el of elements) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('opacity', String(el.opacity / 100));
    const [cx, cy] = getCenter(el);
    const rotation = el.angle ? ` rotate(${(el.angle * 180) / Math.PI} ${cx - el.x} ${cy - el.y})` : '';
    g.setAttribute('transform', `translate(${el.x + shiftX} ${el.y + shiftY})${rotation}`);

    if (el.type === 'freedraw') {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', freedrawPathData(el));
      path.setAttribute('fill', el.strokeColor);
      g.appendChild(path);
    } else if (el.type === 'text') {
      svgText(g, el.text.split('\n'), el, el.width, 0, 0);
    } else if (el.type === 'image') {
      const image = document.createElementNS(SVG_NS, 'image');
      image.setAttribute('href', files[el.fileId] ?? '');
      image.setAttribute('width', String(el.width));
      image.setAttribute('height', String(el.height));
      image.setAttribute('preserveAspectRatio', 'none');
      if (el.flipX || el.flipY) {
        image.setAttribute(
          'transform',
          `translate(${el.flipX ? el.width : 0} ${el.flipY ? el.height : 0}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})`,
        );
      }
      g.appendChild(image);
    } else {
      for (const drawable of getDrawables(el)) g.appendChild(rc.draw(drawable));
      if (!isLinear(el) && el.label) svgLabel(g, el);
    }
    svg.appendChild(g);
  }
  return new XMLSerializer().serializeToString(svg);
}
