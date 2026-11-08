import getStroke from 'perfect-freehand';
import rough from 'roughjs';
import type { Drawable, Options } from 'roughjs/bin/core';
import type { RoughGenerator } from 'roughjs/bin/generator';
import type {
  Arrowhead,
  FreedrawElement,
  LinearElement,
  Point,
  SceneElement,
  ShapeElement,
} from '../model/types';
import { isLinear, isShape } from '../model/types';
import { flattenCurve } from '../math/geometry';

const generator: RoughGenerator = rough.generator();

function roughOptions(el: SceneElement): Options {
  const sw = el.strokeWidth;
  const options: Options = {
    seed: el.seed,
    roughness: el.roughness,
    stroke: el.strokeColor,
    strokeWidth: sw,
    bowing: 1,
    disableMultiStroke: el.strokeStyle !== 'solid' || el.roughness === 0,
    preserveVertices: el.roughness < 2,
  };
  if (el.strokeStyle === 'dashed') options.strokeLineDash = [8, 8 + sw];
  if (el.strokeStyle === 'dotted') options.strokeLineDash = [1.5, 6 + sw];
  return options;
}

function fillOptions(el: SceneElement): Options {
  const options = roughOptions(el);
  if (el.backgroundColor !== 'transparent') {
    options.fill = el.backgroundColor;
    options.fillStyle = el.fillStyle;
    options.fillWeight = el.strokeWidth / 2;
    options.hachureGap = el.strokeWidth * 4;
  }
  return options;
}

function roundedRectPath(w: number, h: number): string {
  const r = Math.min(32, Math.min(w, h) * 0.25);
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
}

function roundedDiamondPath(w: number, h: number): string {
  const k = 0.12;
  const pts: Point[] = [
    [w / 2, 0],
    [w, h / 2],
    [w / 2, h],
    [0, h / 2],
  ];
  const lerp = (a: Point, b: Point, t: number): Point => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  let d = '';
  pts.forEach((p, i) => {
    const prev = pts[(i + 3) % 4];
    const next = pts[(i + 1) % 4];
    const a = lerp(p, prev, k);
    const b = lerp(p, next, k);
    d += `${i === 0 ? 'M' : 'L'} ${a[0]} ${a[1]} Q ${p[0]} ${p[1]} ${b[0]} ${b[1]} `;
  });
  return `${d}Z`;
}

function shapeDrawables(el: ShapeElement): Drawable[] {
  const { width: w, height: h } = el;
  const options = fillOptions(el);
  if (el.type === 'ellipse') return [generator.ellipse(w / 2, h / 2, w, h, options)];
  if (el.type === 'rectangle') {
    return [
      el.roundness === 'round'
        ? generator.path(roundedRectPath(w, h), options)
        : generator.rectangle(0, 0, w, h, options),
    ];
  }
  return [
    el.roundness === 'round'
      ? generator.path(roundedDiamondPath(w, h), options)
      : generator.polygon(
          [
            [w / 2, 0],
            [w, h / 2],
            [w / 2, h],
            [0, h / 2],
          ],
          options,
        ),
  ];
}

function arrowheadDrawables(
  kind: Arrowhead,
  tip: Point,
  from: Point,
  el: LinearElement,
): Drawable[] {
  if (kind === 'none') return [];
  const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const size = 14 + el.strokeWidth * 3;
  const line = { ...roughOptions(el), strokeLineDash: undefined };
  const wing = (offset: number): Point => [
    tip[0] - size * Math.cos(angle + offset),
    tip[1] - size * Math.sin(angle + offset),
  ];
  const solid: Options = { ...line, fill: el.strokeColor, fillStyle: 'solid' };
  switch (kind) {
    case 'arrow': {
      const [a, b] = [wing(Math.PI / 7), wing(-Math.PI / 7)];
      return [
        generator.line(a[0], a[1], tip[0], tip[1], line),
        generator.line(b[0], b[1], tip[0], tip[1], line),
      ];
    }
    case 'triangle':
      return [generator.polygon([tip, wing(Math.PI / 8), wing(-Math.PI / 8)], solid)];
    case 'dot': {
      const d = 8 + el.strokeWidth * 2;
      return [
        generator.circle(
          tip[0] - (d / 2) * Math.cos(angle),
          tip[1] - (d / 2) * Math.sin(angle),
          d,
          solid,
        ),
      ];
    }
    case 'bar': {
      const a = wing(Math.PI / 2);
      const b = wing(-Math.PI / 2);
      return [generator.line(a[0], a[1], b[0], b[1], line)];
    }
  }
}

function linearDrawables(el: LinearElement): Drawable[] {
  const options = roughOptions(el);
  const curved = el.roundness === 'round' && el.points.length > 2;
  const shaft = curved
    ? generator.curve(el.points as [number, number][], options)
    : generator.linearPath(el.points as [number, number][], options);
  const out = [shaft];
  if (el.type === 'arrow') {
    const path = curved ? flattenCurve(el.points) : el.points;
    const n = path.length;
    if (n >= 2 && (path[0][0] !== path[n - 1][0] || path[0][1] !== path[n - 1][1])) {
      out.push(...arrowheadDrawables(el.startArrowhead, path[0], path[1], el));
      out.push(...arrowheadDrawables(el.endArrowhead, path[n - 1], path[n - 2], el));
    }
  }
  return out;
}

export function freedrawPathData(el: FreedrawElement): string {
  const stroke = getStroke(el.points, {
    size: el.strokeWidth * 4.25,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: el.simulatePressure,
    last: true,
  });
  if (stroke.length < 2) return '';
  let d = `M ${stroke[0][0]} ${stroke[0][1]} Q`;
  for (let i = 0; i < stroke.length; i++) {
    const [x0, y0] = stroke[i];
    const [x1, y1] = stroke[(i + 1) % stroke.length];
    d += ` ${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
  }
  return `${d} Z`;
}

interface CacheEntry {
  signature: string;
  points: unknown;
  drawables: Drawable[];
  path: Path2D | null;
}

const cache = new Map<string, CacheEntry>();

function signature(el: SceneElement): string {
  const heads = isLinear(el) ? `${el.startArrowhead}|${el.endArrowhead}` : '';
  return [
    el.type,
    el.width,
    el.height,
    el.seed,
    el.strokeColor,
    el.backgroundColor,
    el.fillStyle,
    el.strokeWidth,
    el.strokeStyle,
    el.roughness,
    el.roundness,
    heads,
  ].join('|');
}

function entryFor(el: SceneElement): CacheEntry {
  const sig = signature(el);
  const points = isLinear(el) || el.type === 'freedraw' ? el.points : null;
  const hit = cache.get(el.id);
  if (hit && hit.signature === sig && hit.points === points) return hit;
  const entry: CacheEntry = {
    signature: sig,
    points,
    drawables: isShape(el) ? shapeDrawables(el) : isLinear(el) ? linearDrawables(el) : [],
    path: el.type === 'freedraw' ? new Path2D(freedrawPathData(el)) : null,
  };
  cache.set(el.id, entry);
  return entry;
}

export const getDrawables = (el: SceneElement): Drawable[] => entryFor(el).drawables;
export const getFreedrawPath = (el: FreedrawElement): Path2D | null => entryFor(el).path;

/** Evita crescimento do cache quando elementos são removidos. */
export function pruneShapeCache(live: number): void {
  if (cache.size > live * 2 + 64) cache.clear();
}
