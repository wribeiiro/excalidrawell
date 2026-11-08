import { beforeEach, describe, expect, it } from 'vitest';
import { getCenter, getElementBounds, rotate } from '../math/geometry';
import { getElementAt, hitElement } from '../math/hitTest';
import {
  createFreedraw,
  createLinear,
  createShape,
  DEFAULT_STYLE,
  withAbsolutePoints,
  withFreedrawPoints,
} from '../model/elements';
import type { LinearElement, Point, SceneElement, ShapeElement } from '../model/types';
import { parseScene, serializeScene } from '../io/scene';
import { useStore } from '../store/store';
import { anchorPoint, updateBindings } from './binding';
import { align, cloneElements, distribute, removeElements, reorder } from './operations';
import { resizeElement, resizeElements, rotateElements } from './transform';

const box = (x: number, y: number, w: number, h: number, patch: Partial<ShapeElement> = {}) => ({
  ...createShape('rectangle', x, y, DEFAULT_STYLE),
  width: w,
  height: h,
  ...patch,
});

const arrow = (points: Point[], patch: Partial<LinearElement> = {}): LinearElement => ({
  ...withAbsolutePoints(createLinear('arrow', 0, 0, DEFAULT_STYLE), points),
  ...patch,
});

const opts = { keepAspect: false, fromCenter: false };
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('resizeElement', () => {
  it('mantém o canto oposto fixo', () => {
    const r = resizeElement(box(10, 10, 100, 50), 'se', [210, 110], opts);
    expect([r.x, r.y, r.width, r.height]).toEqual([10, 10, 200, 100]);
  });

  it('inverte ao cruzar o canto oposto', () => {
    const r = resizeElement(box(10, 10, 100, 50), 'e', [-40, 30], opts);
    expect([r.x, r.width]).toEqual([-40, 50]);
  });

  it('mantém o canto oposto fixo mesmo rotacionado', () => {
    const start = box(0, 0, 100, 50, { angle: Math.PI / 3 });
    const fixed = rotate([0, 0], getCenter(start), start.angle);
    const r = resizeElement(start, 'se', [160, 200], opts);
    const after = rotate([r.x, r.y], getCenter(r), r.angle);
    near(after[0], fixed[0]);
    near(after[1], fixed[1]);
  });

  it('preserva a proporção com Shift', () => {
    const r = resizeElement(box(0, 0, 100, 50), 'se', [300, 60], { ...opts, keepAspect: true });
    expect([r.width, r.height]).toEqual([300, 150]);
  });

  it('escala os pontos do traço livre ao inverter', () => {
    const f = withFreedrawPoints(createFreedraw(0, 0, DEFAULT_STYLE, true), [
      [0, 0, 0.5],
      [100, 50, 0.5],
    ]);
    const r = resizeElement(f, 'e', [-100, 25], opts);
    if (r.type !== 'freedraw') throw new Error();
    expect(r.points.map((p) => p[0])).toEqual([100, 0]);
    expect(r.x).toBe(-100);
  });
});

describe('transformação em grupo', () => {
  it('escala em torno do canto oposto', () => {
    const [a, b] = resizeElements([box(0, 0, 10, 10), box(90, 90, 10, 10)], 'se', [200, 200], false);
    expect([a.x, a.width]).toEqual([0, 20]);
    expect([b.x, b.width]).toEqual([180, 20]);
  });

  it('grava a rotação nos pontos de setas', () => {
    const [r] = rotateElements([arrow([[0, 0], [10, 0]])], [0, 0], Math.PI / 2);
    if (r.type !== 'arrow') throw new Error();
    expect(r.angle).toBe(0);
    near(r.points[1][0], 0);
    near(r.points[1][1], 10);
  });
});

describe('hit test', () => {
  it('forma sem fundo só responde na borda', () => {
    const r = box(0, 0, 100, 100);
    expect(hitElement(r, [50, 50], 6)).toBe(false);
    expect(hitElement(r, [100, 50], 6)).toBe(true);
  });

  it('forma com fundo ou rótulo responde por dentro', () => {
    expect(hitElement(box(0, 0, 100, 100, { backgroundColor: '#fff' }), [50, 50], 6)).toBe(true);
    expect(hitElement(box(0, 0, 100, 100, { label: 'oi' }), [50, 50], 6)).toBe(true);
  });

  it('respeita a rotação', () => {
    const r = box(0, 0, 200, 20, { angle: Math.PI / 2, backgroundColor: '#fff' });
    expect(hitElement(r, [100, 90], 2)).toBe(true);
    expect(hitElement(r, [10, 10], 2)).toBe(false);
  });

  it('pega o elemento do topo e ignora travados', () => {
    const a = box(0, 0, 100, 100, { backgroundColor: '#fff' });
    const b = box(0, 0, 100, 100, { backgroundColor: '#000', locked: true });
    expect(getElementAt([a, b], [50, 50], 1)?.id).toBe(a.id);
    expect(getElementAt([a, b], [50, 50], 1, true)?.id).toBe(b.id);
  });
});

describe('ligações de setas', () => {
  it('ancora na borda com respiro', () => {
    const [x, y] = anchorPoint(box(0, 0, 100, 100), [300, 50]);
    expect([x, y]).toEqual([106, 50]);
  });

  it('acompanha a forma movida', () => {
    const r = box(200, 0, 100, 100);
    const a = arrow([[0, 50], [194, 50]], { endBinding: r.id });
    const moved = { ...r, x: 400 };
    const [, updated] = updateBindings([moved, a], new Set([r.id])) as [SceneElement, LinearElement];
    near(updated.x + updated.points[1][0], 394);
  });

  it('solta a ligação quando a forma é excluída', () => {
    const r = box(200, 0, 100, 100);
    const a = arrow([[0, 50], [194, 50]], { endBinding: r.id });
    const [remaining] = removeElements([r, a], new Set([r.id])) as LinearElement[];
    expect(remaining.endBinding).toBeNull();
  });

  it('clone só mantém ligações dentro do conjunto copiado', () => {
    const r = box(200, 0, 100, 100);
    const a = arrow([[0, 50], [194, 50]], { endBinding: r.id });
    const [alone] = cloneElements([a], 0, 0) as LinearElement[];
    expect(alone.endBinding).toBeNull();
    const [cr, ca] = cloneElements([r, a], 0, 0) as [SceneElement, LinearElement];
    expect(ca.endBinding).toBe(cr.id);
    expect(cr.id).not.toBe(r.id);
  });
});

describe('operações', () => {
  const ids = (list: SceneElement[]) => list.map((el) => el.id);

  it('reordena camadas', () => {
    const [a, b, c] = [box(0, 0, 1, 1), box(0, 0, 1, 1), box(0, 0, 1, 1)];
    const set = new Set([a.id]);
    expect(ids(reorder([a, b, c], set, 'front'))).toEqual(ids([b, c, a]));
    expect(ids(reorder([a, b, c], set, 'forward'))).toEqual(ids([b, a, c]));
    expect(ids(reorder([b, c, a], set, 'backward'))).toEqual(ids([b, a, c]));
    expect(ids(reorder([b, c, a], set, 'back'))).toEqual(ids([a, b, c]));
  });

  it('alinha à esquerda movendo grupos como unidade', () => {
    const a = box(0, 0, 10, 10);
    const b = box(50, 0, 10, 10, { groupId: 'g' });
    const c = box(70, 0, 10, 10, { groupId: 'g' });
    const [, nb, nc] = align([a, b, c], [a, b, c], 'left');
    expect([nb.x, nc.x]).toEqual([0, 20]);
  });

  it('distribui com espaços iguais', () => {
    const a = box(0, 0, 10, 10);
    const b = box(15, 0, 10, 10);
    const c = box(100, 0, 10, 10);
    const [, nb] = distribute([a, b, c], [a, b, c], 'x');
    expect(nb.x).toBe(50);
  });

  it('calcula limites de elementos rotacionados', () => {
    const b = getElementBounds(box(0, 0, 100, 20, { angle: Math.PI / 2 }));
    near(b.maxY - b.minY, 100);
    near(b.maxX - b.minX, 20);
  });
});

describe('arquivo', () => {
  it('faz ida e volta preservando elementos', () => {
    const scene = [box(1, 2, 3, 4, { label: 'olá' }), arrow([[5, 5], [10, 10]])];
    expect(parseScene(serializeScene(scene, {})).elements).toEqual(scene);
  });

  it('descarta dados inválidos e imagens inseguras', () => {
    const raw = JSON.stringify({
      type: 'excalidrawell',
      schemaVersion: 1,
      files: { svg: 'data:image/svg+xml;base64,AAAA', ok: 'data:image/png;base64,AAAA' },
      elements: [
        { type: 'nave' },
        { type: 'arrow', points: 'x' },
        { type: 'line', points: [[0, 0], ['a', 1]] },
        { type: 'image', fileId: 'svg' },
        { type: 'image', fileId: 'ok', x: 'NaN', width: 10, height: 10 },
      ],
    });
    const { elements, files } = parseScene(raw);
    expect(Object.keys(files)).toEqual(['ok']);
    expect(elements).toHaveLength(1);
    expect(elements[0].x).toBe(0);
  });

  it('recusa arquivos de outro formato ou de versão futura', () => {
    expect(() => parseScene('{')).toThrow();
    expect(() => parseScene('{"type":"x"}')).toThrow();
    expect(() => parseScene('{"type":"excalidrawell","schemaVersion":99}')).toThrow(/mais nova/);
  });
});

describe('histórico', () => {
  beforeEach(() => useStore.getState().loadScene({ elements: [], files: {} }));
  const s = () => useStore.getState();

  it('desfaz e refaz por commit, não por passo intermediário', () => {
    const a = box(0, 0, 10, 10);
    s().setElements([a]);
    s().setElements([{ ...a, x: 5 }]);
    s().setElements([{ ...a, x: 9 }]);
    s().commit();
    s().undo();
    expect(s().elements).toEqual([]);
    s().redo();
    expect(s().elements[0].x).toBe(9);
  });

  it('nova edição limpa o refazer e undo limpa seleção órfã', () => {
    const a = box(0, 0, 10, 10);
    s().setElements([a]);
    s().commit();
    s().select([a.id]);
    s().undo();
    expect(s().selectedIds.size).toBe(0);
    s().setElements([box(1, 1, 1, 1)]);
    s().commit();
    s().redo();
    expect(s().future).toHaveLength(0);
    expect(s().elements[0].id).not.toBe(a.id);
  });

  it('revert descarta o gesto em andamento', () => {
    s().setElements([box(0, 0, 10, 10)]);
    s().revert();
    expect(s().elements).toEqual([]);
  });
});
