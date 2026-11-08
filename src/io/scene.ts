import { nanoid } from 'nanoid';
import { DEFAULT_STYLE, newSeed } from '../model/elements';
import type { Point, PointBinding, SceneElement, SceneFiles } from '../model/types';
import { updateBindings } from '../scene/binding';
import { isSafeImageUrl } from './images';

export const FILE_TYPE = 'excalidrawell';
export const SCHEMA_VERSION = 1;

export interface SceneFile {
  type: typeof FILE_TYPE;
  schemaVersion: number;
  elements: SceneElement[];
  files: SceneFiles;
}

const TYPES = ['rectangle', 'diamond', 'ellipse', 'text', 'line', 'arrow', 'freedraw', 'image'];
const finite = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Devolve `value` se for string aceita (qualquer uma, com `allowed` nulo). */
function oneOf<T extends string>(value: unknown, allowed: string[] | null, fallback: T): T {
  return typeof value === 'string' && (!allowed || allowed.includes(value)) ? (value as T) : fallback;
}

/** Aceita o formato atual e o antigo, em que a ligação era só o id da forma. */
function restoreBinding(raw: unknown): PointBinding | null {
  if (typeof raw === 'string') return { elementId: raw, focus: 0, gap: 6 };
  if (!raw || typeof raw !== 'object') return null;
  const { elementId, focus, gap } = raw as Record<string, unknown>;
  if (typeof elementId !== 'string') return null;
  return { elementId, focus: finite(focus, 0), gap: Math.max(1, finite(gap, 6)) };
}

function validPoints(v: unknown, min: number): boolean {
  return (
    Array.isArray(v) &&
    v.length >= min &&
    v.every(
      (p) =>
        Array.isArray(p) && p.length >= 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n)),
    )
  );
}

/** `type` vem de `raw`, já validado contra TYPES. */
const finish = (element: object) => element as SceneElement;

function restoreElement(raw: Record<string, unknown>, files: SceneFiles): SceneElement | null {
  const type = raw.type as string;
  if (!TYPES.includes(type)) return null;
  const base = {
    type,
    id: typeof raw.id === 'string' ? raw.id : nanoid(),
    x: finite(raw.x, 0),
    y: finite(raw.y, 0),
    width: Math.max(0, finite(raw.width, 0)),
    height: Math.max(0, finite(raw.height, 0)),
    angle: finite(raw.angle, 0),
    seed: Math.max(1, Math.floor(finite(raw.seed, newSeed()))),
    groupId: typeof raw.groupId === 'string' ? raw.groupId : null,
    locked: raw.locked === true,
    strokeColor: oneOf(raw.strokeColor, null, DEFAULT_STYLE.strokeColor),
    backgroundColor: oneOf(raw.backgroundColor, null, DEFAULT_STYLE.backgroundColor),
    fillStyle: oneOf(raw.fillStyle, ['hachure', 'cross-hatch', 'solid'], DEFAULT_STYLE.fillStyle),
    strokeWidth: Math.max(0.5, finite(raw.strokeWidth, DEFAULT_STYLE.strokeWidth)),
    strokeStyle: oneOf(raw.strokeStyle, ['solid', 'dashed', 'dotted'], DEFAULT_STYLE.strokeStyle),
    roughness: Math.max(0, finite(raw.roughness, DEFAULT_STYLE.roughness)),
    roundness: oneOf(raw.roundness, ['sharp', 'round'], DEFAULT_STYLE.roundness),
    opacity: Math.min(100, Math.max(0, finite(raw.opacity, 100))),
  };
  const text = {
    fontSize: Math.max(4, finite(raw.fontSize, DEFAULT_STYLE.fontSize)),
    fontFamily: oneOf(raw.fontFamily, ['hand', 'sans', 'mono'], DEFAULT_STYLE.fontFamily),
    textAlign: oneOf(raw.textAlign, ['left', 'center', 'right'], DEFAULT_STYLE.textAlign),
  };
  const heads = ['none', 'arrow', 'triangle', 'dot', 'bar'];

  if (type === 'line' || type === 'arrow') {
    if (!validPoints(raw.points, 2)) return null;
    const first = (raw.points as Point[])[0];
    const points = (raw.points as Point[]).map(([x, y]): Point => [x - first[0], y - first[1]]);
    return finish({
      ...base,
      x: base.x + first[0],
      y: base.y + first[1],
      points,
      angle: 0,
      startArrowhead: oneOf(raw.startArrowhead, heads, 'none'),
      endArrowhead: oneOf(raw.endArrowhead, heads, 'none'),
      startBinding: restoreBinding(raw.startBinding),
      endBinding: restoreBinding(raw.endBinding),
    });
  }
  if (type === 'freedraw') {
    if (!validPoints(raw.points, 1)) return null;
    return finish({
      ...base,
      points: raw.points,
      simulatePressure: raw.simulatePressure !== false,
    });
  }
  if (type === 'image') {
    if (typeof raw.fileId !== 'string' || !files[raw.fileId]) return null;
    return finish({ ...base, fileId: raw.fileId, flipX: raw.flipX === true, flipY: raw.flipY === true });
  }
  if (type === 'text') {
    return finish({ ...base, ...text, text: typeof raw.text === 'string' ? raw.text : '' });
  }
  return finish({ ...base, ...text, label: typeof raw.label === 'string' ? raw.label : '' });
}

export function restoreFiles(raw: unknown): SceneFiles {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).filter(([, url]) => isSafeImageUrl(url))) as SceneFiles;
}

/** Valida dados externos: descarta o que for inválido e completa campos ausentes. */
export function restoreElements(raw: unknown, files: SceneFiles): SceneElement[] {
  if (!Array.isArray(raw)) return [];
  const elements = raw.flatMap((item) =>
    item && typeof item === 'object' ? (restoreElement(item as Record<string, unknown>, files) ?? []) : [],
  );
  return updateBindings(elements);
}

export function serializeScene(elements: SceneElement[], files: SceneFiles): string {
  const used = new Set(elements.flatMap((el) => (el.type === 'image' ? [el.fileId] : [])));
  const data: SceneFile = {
    type: FILE_TYPE,
    schemaVersion: SCHEMA_VERSION,
    elements,
    files: Object.fromEntries(Object.entries(files).filter(([id]) => used.has(id))),
  };
  return JSON.stringify(data);
}

export function parseScene(text: string): { elements: SceneElement[]; files: SceneFiles } {
  let data: Partial<SceneFile>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um quadro válido.');
  }
  if (data?.type !== FILE_TYPE) throw new Error('O arquivo não é um quadro do Excalidrawell.');
  if ((data.schemaVersion ?? 0) > SCHEMA_VERSION) {
    throw new Error('Este quadro foi salvo por uma versão mais nova do app.');
  }
  const files = restoreFiles(data.files);
  return { elements: restoreElements(data.elements, files), files };
}
