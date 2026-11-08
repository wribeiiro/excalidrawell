import type { FontFamily, ShapeElement } from '../model/types';

export const FONT_STACKS: Record<FontFamily, string> = {
  hand: 'Excalifont, "Comic Sans MS", cursive',
  sans: 'Nunito, system-ui, sans-serif',
  mono: '"Comic Shanns", ui-monospace, monospace',
};

export const LINE_HEIGHT = 1.25;

export const fontString = (size: number, family: FontFamily) =>
  `${size}px ${FONT_STACKS[family]}`;

let measureCtx: CanvasRenderingContext2D | null = null;

function textWidth(line: string, font: string, size: number): number {
  if (typeof document === 'undefined') return line.length * size * 0.55;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return line.length * size * 0.55;
  measureCtx.font = font;
  return measureCtx.measureText(line).width;
}

export function measureText(text: string, size: number, family: FontFamily) {
  const lines = (text || ' ').split('\n');
  const font = fontString(size, family);
  return {
    width: Math.max(1, ...lines.map((l) => textWidth(l, font, size))),
    height: lines.length * size * LINE_HEIGHT,
  };
}

/** Quebra o texto por palavras para caber em `maxWidth`, respeitando quebras explícitas. */
export function wrapLines(
  text: string,
  size: number,
  family: FontFamily,
  maxWidth: number,
): string[] {
  const font = fontString(size, family);
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && textWidth(candidate, font, size) > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

/** Largura útil do rótulo: losangos e elipses têm menos área aproveitável. */
export function labelWidth(el: ShapeElement): number {
  const factor = el.type === 'rectangle' ? 1 : el.type === 'ellipse' ? 0.72 : 0.55;
  return Math.max(10, el.width * factor - 16);
}
