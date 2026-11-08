import { nanoid } from 'nanoid';
import { GRID_SIZE, newSeed } from '../model/elements';
import type { SceneElement } from '../model/types';
import { isLinear } from '../model/types';
import type { Bounds } from '../math/geometry';
import { getCommonBounds } from '../math/geometry';
import { updateBindings } from './binding';

export type Align = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export type Layer = 'front' | 'forward' | 'backward' | 'back';

export function translate(el: SceneElement, dx: number, dy: number): SceneElement {
  return { ...el, x: el.x + dx, y: el.y + dy };
}

export function removeElements(
  elements: readonly SceneElement[],
  ids: ReadonlySet<string>,
): SceneElement[] {
  return updateBindings(elements.filter((el) => !ids.has(el.id)));
}

/**
 * Clona elementos com ids e grupos novos. Ligações de setas só são mantidas
 * quando a forma de destino também foi clonada.
 */
export function cloneElements(
  source: readonly SceneElement[],
  dx: number,
  dy: number,
): SceneElement[] {
  const ids = new Map(source.map((el) => [el.id, nanoid()]));
  const groups = new Map<string, string>();
  const groupFor = (id: string | null) => {
    if (!id) return null;
    if (!groups.has(id)) groups.set(id, nanoid());
    return groups.get(id) ?? null;
  };
  return source.map((el) => {
    const base = {
      ...translate(el, dx, dy),
      id: ids.get(el.id) as string,
      seed: newSeed(),
      groupId: groupFor(el.groupId),
      locked: false,
    } as SceneElement;
    if (!isLinear(base)) return base;
    return {
      ...base,
      startBinding: base.startBinding ? (ids.get(base.startBinding) ?? null) : null,
      endBinding: base.endBinding ? (ids.get(base.endBinding) ?? null) : null,
    };
  });
}

export function reorder(
  elements: readonly SceneElement[],
  ids: ReadonlySet<string>,
  layer: Layer,
): SceneElement[] {
  const inSet = (el: SceneElement) => ids.has(el.id);
  if (layer === 'front') return [...elements.filter((e) => !inSet(e)), ...elements.filter(inSet)];
  if (layer === 'back') return [...elements.filter(inSet), ...elements.filter((e) => !inSet(e))];
  const next = [...elements];
  if (layer === 'forward') {
    for (let i = next.length - 2; i >= 0; i--) {
      if (inSet(next[i]) && !inSet(next[i + 1])) [next[i], next[i + 1]] = [next[i + 1], next[i]];
    }
  } else {
    for (let i = 1; i < next.length; i++) {
      if (inSet(next[i]) && !inSet(next[i - 1])) [next[i], next[i - 1]] = [next[i - 1], next[i]];
    }
  }
  return next;
}

/** Elementos do mesmo grupo se movem como uma unidade ao alinhar e distribuir. */
function units(selected: readonly SceneElement[]): SceneElement[][] {
  const groups = new Map<string, SceneElement[]>();
  const out: SceneElement[][] = [];
  for (const el of selected) {
    if (!el.groupId) {
      out.push([el]);
      continue;
    }
    let list = groups.get(el.groupId);
    if (!list) {
      list = [];
      groups.set(el.groupId, list);
      out.push(list);
    }
    list.push(el);
  }
  return out;
}

function shifted(
  elements: SceneElement[],
  deltas: Map<string, [number, number]>,
): SceneElement[] {
  const moved = elements.map((el) => {
    const d = deltas.get(el.id);
    return d ? translate(el, d[0], d[1]) : el;
  });
  return updateBindings(moved, new Set(deltas.keys()));
}

export const unitCount = (selected: readonly SceneElement[]) => units(selected).length;

export function align(
  elements: SceneElement[],
  selected: readonly SceneElement[],
  kind: Align,
): SceneElement[] {
  const all = getCommonBounds(selected) as Bounds;
  const deltas = new Map<string, [number, number]>();
  for (const unit of units(selected)) {
    const b = getCommonBounds(unit) as Bounds;
    let dx = 0;
    let dy = 0;
    if (kind === 'left') dx = all.minX - b.minX;
    if (kind === 'right') dx = all.maxX - b.maxX;
    if (kind === 'hcenter') dx = (all.minX + all.maxX) / 2 - (b.minX + b.maxX) / 2;
    if (kind === 'top') dy = all.minY - b.minY;
    if (kind === 'bottom') dy = all.maxY - b.maxY;
    if (kind === 'vcenter') dy = (all.minY + all.maxY) / 2 - (b.minY + b.maxY) / 2;
    for (const el of unit) deltas.set(el.id, [dx, dy]);
  }
  return shifted(elements, deltas);
}

/** Distribui as unidades com espaços iguais entre as bordas. */
export function distribute(
  elements: SceneElement[],
  selected: readonly SceneElement[],
  axis: 'x' | 'y',
): SceneElement[] {
  const entries = units(selected)
    .map((unit) => ({ unit, b: getCommonBounds(unit) as Bounds }))
    .map(({ unit, b }) => ({
      unit,
      start: axis === 'x' ? b.minX : b.minY,
      end: axis === 'x' ? b.maxX : b.maxY,
    }))
    .sort((a, b) => a.start - b.start);
  if (entries.length < 3) return elements;
  const span = entries[entries.length - 1].end - entries[0].start;
  const used = entries.reduce((sum, e) => sum + (e.end - e.start), 0);
  const gap = (span - used) / (entries.length - 1);
  const deltas = new Map<string, [number, number]>();
  let cursor = entries[0].start;
  for (const entry of entries) {
    const delta = cursor - entry.start;
    for (const el of entry.unit) deltas.set(el.id, axis === 'x' ? [delta, 0] : [0, delta]);
    cursor += entry.end - entry.start + gap;
  }
  return shifted(elements, deltas);
}

export function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

