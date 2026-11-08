export type Point = [number, number];
export type FreedrawPoint = [number, number, number];

export type FillStyle = 'hachure' | 'cross-hatch' | 'solid';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type Roundness = 'sharp' | 'round';
export type Arrowhead = 'none' | 'arrow' | 'triangle' | 'dot' | 'bar';
export type FontFamily = 'hand' | 'sans' | 'mono';
export type TextAlign = 'left' | 'center' | 'right';

export interface StyleProps {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  roundness: Roundness;
  opacity: number;
}

export interface TextProps {
  fontSize: number;
  fontFamily: FontFamily;
  textAlign: TextAlign;
}

export interface ArrowProps {
  startArrowhead: Arrowhead;
  endArrowhead: Arrowhead;
}

export type StyleDefaults = StyleProps & TextProps & ArrowProps;

interface BaseElement extends StyleProps {
  id: string;
  /** Canto superior esquerdo sem rotação. Em linhas/setas é a origem de `points`. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Radianos, em torno do centro. Linhas e setas ficam sempre em 0: a rotação é gravada nos pontos. */
  angle: number;
  /** Semente do roughjs: mantém o traço idêntico entre renders. */
  seed: number;
  groupId: string | null;
  locked: boolean;
}

export type ShapeType = 'rectangle' | 'diamond' | 'ellipse';

export interface ShapeElement extends BaseElement, TextProps {
  type: ShapeType;
  label: string;
}

export interface TextElement extends BaseElement, TextProps {
  type: 'text';
  text: string;
}

export interface LinearElement extends BaseElement, ArrowProps {
  type: 'line' | 'arrow';
  /** Relativos a (x, y); points[0] é sempre [0, 0]. */
  points: Point[];
  startBinding: string | null;
  endBinding: string | null;
}

export interface FreedrawElement extends BaseElement {
  type: 'freedraw';
  points: FreedrawPoint[];
  simulatePressure: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  fileId: string;
  flipX: boolean;
  flipY: boolean;
}

export type SceneElement =
  | ShapeElement
  | TextElement
  | LinearElement
  | FreedrawElement
  | ImageElement;

export type Tool =
  | 'select'
  | 'hand'
  | ShapeType
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'eraser';

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/** Arquivos binários (imagens) por id, como data URL. */
export type SceneFiles = Record<string, string>;

export const isLinear = (el: SceneElement): el is LinearElement =>
  el.type === 'line' || el.type === 'arrow';

export const isShape = (el: SceneElement): el is ShapeElement =>
  el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse';

export const isBindable = (el: SceneElement): boolean =>
  isShape(el) || el.type === 'image' || el.type === 'text';
