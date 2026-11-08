import { nanoid } from 'nanoid';
import type {
  FreedrawElement,
  FreedrawPoint,
  ImageElement,
  LinearElement,
  Point,
  SceneElement,
  ShapeElement,
  ShapeType,
  StyleDefaults,
  StyleProps,
  TextElement,
  TextProps,
} from './types';

export const GRID_SIZE = 20;

export const DEFAULT_STYLE: StyleDefaults = {
  strokeColor: '#16243f',
  backgroundColor: 'transparent',
  fillStyle: 'hachure',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  roundness: 'round',
  opacity: 100,
  fontSize: 24,
  fontFamily: 'hand',
  textAlign: 'left',
  startArrowhead: 'none',
  endArrowhead: 'arrow',
};

export const newSeed = () => Math.floor(Math.random() * 2 ** 31) + 1;

function base(style: StyleDefaults, x: number, y: number) {
  const s: StyleProps = {
    strokeColor: style.strokeColor,
    backgroundColor: style.backgroundColor,
    fillStyle: style.fillStyle,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    roughness: style.roughness,
    roundness: style.roundness,
    opacity: style.opacity,
  };
  return {
    ...s,
    id: nanoid(),
    x,
    y,
    width: 0,
    height: 0,
    angle: 0,
    seed: newSeed(),
    groupId: null,
    locked: false,
  };
}

const textProps = (style: StyleDefaults): TextProps => ({
  fontSize: style.fontSize,
  fontFamily: style.fontFamily,
  textAlign: style.textAlign,
});

export const createShape = (
  type: ShapeType,
  x: number,
  y: number,
  style: StyleDefaults,
): ShapeElement => ({
  ...base(style, x, y),
  ...textProps(style),
  textAlign: 'center',
  type,
  label: '',
});

export const createText = (x: number, y: number, style: StyleDefaults, text = ''): TextElement => ({
  ...base(style, x, y),
  ...textProps(style),
  type: 'text',
  text,
});

export const createLinear = (
  type: 'line' | 'arrow',
  x: number,
  y: number,
  style: StyleDefaults,
): LinearElement => ({
  ...base(style, x, y),
  type,
  points: [
    [0, 0],
    [0, 0],
  ],
  startBinding: null,
  endBinding: null,
  startArrowhead: type === 'arrow' ? style.startArrowhead : 'none',
  endArrowhead: type === 'arrow' ? style.endArrowhead : 'none',
});

export const createFreedraw = (
  x: number,
  y: number,
  style: StyleDefaults,
  simulatePressure: boolean,
): FreedrawElement => ({
  ...base(style, x, y),
  type: 'freedraw',
  points: [],
  simulatePressure,
});

export const createImage = (
  x: number,
  y: number,
  width: number,
  height: number,
  fileId: string,
  style: StyleDefaults,
): ImageElement => ({
  ...base(style, x, y),
  type: 'image',
  width,
  height,
  fileId,
  flipX: false,
  flipY: false,
});

/** Recebe pontos absolutos e devolve o elemento com a origem e a extensão normalizadas. */
export function withAbsolutePoints(el: LinearElement, abs: Point[]): LinearElement {
  const [ox, oy] = abs[0];
  const points = abs.map(([x, y]): Point => [x - ox, y - oy]);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    ...el,
    x: ox,
    y: oy,
    points,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export const absolutePoints = (el: LinearElement): Point[] =>
  el.points.map(([x, y]) => [el.x + x, el.y + y]);

/** Recebe pontos absolutos e normaliza o traço livre para começar em (0, 0) na caixa. */
export function withFreedrawPoints(el: FreedrawElement, abs: FreedrawPoint[]): FreedrawElement {
  const xs = abs.map((p) => p[0]);
  const ys = abs.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    ...el,
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    points: abs.map(([x, y, p]) => [x - minX, y - minY, p]),
  };
}

export type { SceneElement };
