import {
  absolutePoints,
  createFreedraw,
  createLinear,
  createShape,
  createText,
  withAbsolutePoints,
  withFreedrawPoints,
} from '../model/elements';
import type {
  FreedrawElement,
  FreedrawPoint,
  LinearElement,
  Point,
  SceneElement,
} from '../model/types';
import { isLinear, isShape } from '../model/types';
import { distance, getCommonBounds, snapAngle } from '../math/geometry';
import { getElementAt, hitElement } from '../math/hitTest';
import { measureText } from '../render/text';
import { expandGroups, finishEditing, startEditing } from '../store/commands';
import { useStore } from '../store/store';
import { findBindable, updateBindings } from '../scene/binding';
import { cloneElements, removeElements, snapToGrid, translate } from '../scene/operations';
import type { Frame, HandleName } from '../scene/selection';
import {
  edgeHandleAt,
  getHandles,
  getSelected,
  getSelectionFrame,
  handleCursor,
  midpoints,
} from '../scene/selection';
import type { Handle } from '../scene/transform';
import { resizeElement, resizeElements, rotateElements } from '../scene/transform';

type Mode =
  | { kind: 'idle' }
  | { kind: 'pan'; lastX: number; lastY: number }
  | { kind: 'shape'; id: string; origin: Point }
  | { kind: 'freedraw'; id: string; points: FreedrawPoint[] }
  | { kind: 'linear-new'; id: string; downX: number; downY: number }
  | { kind: 'multipoint'; id: string }
  | { kind: 'erase'; last: Point }
  | { kind: 'marquee'; origin: Point; base: Set<string> }
  | {
      kind: 'drag';
      origin: Point;
      starts: Map<string, SceneElement>;
      moved: boolean;
      clearOnClick: boolean;
      downX: number;
      downY: number;
      duplicated: boolean;
    }
  | { kind: 'resize'; handle: Handle; starts: SceneElement[] }
  | { kind: 'rotate'; pivot: Point; startAngle: number; starts: SceneElement[] }
  | { kind: 'point'; id: string; index: number };

const DRAG_THRESHOLD = 3;
const store = () => useStore.getState();

export class InteractionController {
  private mode: Mode = { kind: 'idle' };
  private canvas: HTMLCanvasElement;
  private spaceDown = false;
  private touches = new Map<number, Point>();
  private pinch: { distance: number; center: Point } | null = null;
  private lastFinish = 0;
  /** Última posição do ponteiro, usada ao colar. */
  pointer: Point = [0, 0];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  private screen(e: { clientX: number; clientY: number }): Point {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  private world(e: { clientX: number; clientY: number }): Point {
    const { viewport: v } = store();
    const [x, y] = this.screen(e);
    return [x / v.zoom - v.scrollX, y / v.zoom - v.scrollY];
  }

  private snapPoint(p: Point): Point {
    return store().grid ? [snapToGrid(p[0]), snapToGrid(p[1])] : p;
  }

  private selected(): SceneElement[] {
    return getSelected(store().elements, store().selectedIds);
  }

  private update(id: string, fn: (el: SceneElement) => SceneElement) {
    const s = store();
    s.setElements(s.elements.map((el) => (el.id === id ? fn(el) : el)));
  }

  private find(id: string) {
    return store().elements.find((el) => el.id === id);
  }

  /** Volta para a seleção, salvo com a ferramenta travada. */
  private toolDone(ids: string[]) {
    const s = store();
    if (!s.toolLocked) {
      s.setTool('select');
      s.select(ids);
    }
  }

  private handleAt(p: Point):
    | { type: 'frame'; name: HandleName; frame: Frame }
    | { type: 'point'; index: number; el: LinearElement }
    | { type: 'mid'; index: number; el: LinearElement }
    | null {
    const selected = this.selected();
    if (selected.length === 0 || selected.some((el) => el.locked)) return null;
    const { zoom } = store().viewport;
    const reach = 9 / zoom;
    const frame = getSelectionFrame(selected);
    if (frame) {
      for (const handle of getHandles(frame, zoom)) {
        if (distance(p, handle.point) <= reach) return { type: 'frame', name: handle.name, frame };
      }
      const edge = edgeHandleAt(frame, p, zoom, selected);
      return edge ? { type: 'frame', name: edge, frame } : null;
    }
    const el = selected[0];
    if (!isLinear(el)) return null;
    const abs = absolutePoints(el);
    for (let i = 0; i < abs.length; i++) {
      if (distance(p, abs[i]) <= reach) return { type: 'point', index: i, el };
    }
    const mids = midpoints(abs);
    for (let i = 0; i < mids.length; i++) {
      if (distance(p, mids[i]) <= reach) return { type: 'mid', index: i, el };
    }
    return null;
  }

  private insideFrame(p: Point): boolean {
    const b = getCommonBounds(this.selected());
    return !!b && p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minY && p[1] <= b.maxY;
  }

  private beginDrag(e: PointerEvent, p: Point, clearOnClick: boolean) {
    const starts = new Map(
      this.selected()
        .filter((el) => !el.locked)
        .map((el) => [el.id, el]),
    );
    this.mode = {
      kind: 'drag',
      origin: p,
      starts,
      moved: false,
      clearOnClick,
      downX: e.clientX,
      downY: e.clientY,
      duplicated: false,
    };
  }

  /** Cria ou edita texto no ponto: formas recebem rótulo, texto existente abre para edição. */
  private textAt(p: Point) {
    const s = store();
    const hit =
      getElementAt(s.elements, p, s.viewport.zoom) ??
      findBindable(s.elements, p, null, s.viewport.zoom);
    if (hit && (hit.type === 'text' || isShape(hit))) {
      startEditing(hit.id);
      return;
    }
    const lh = measureText(' ', s.style.fontSize, s.style.fontFamily);
    const el = { ...createText(p[0], p[1] - lh.height / 2, s.style), ...lh };
    s.setElements([...s.elements, el]);
    startEditing(el.id);
  }

  onPointerDown = (e: PointerEvent) => {
    const s = store();
    if (s.contextMenu) s.set({ contextMenu: null });
    if (s.editing) {
      finishEditing();
      if (store().tool === 'select') return;
    }

    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, this.screen(e));
      if (this.touches.size === 2) {
        this.cancelGesture();
        this.pinch = this.pinchState();
        return;
      }
    }
    if (e.button === 2) return;
    this.canvas.setPointerCapture(e.pointerId);

    if (e.button === 1 || this.spaceDown || s.tool === 'hand') {
      this.mode = { kind: 'pan', lastX: e.clientX, lastY: e.clientY };
      s.set({ cursor: 'grabbing' });
      return;
    }

    const p = this.world(e);
    const snapped = this.snapPoint(p);

    if (this.mode.kind === 'multipoint') {
      this.addMultipointVertex(snapped);
      return;
    }

    switch (s.tool) {
      case 'select':
        this.downSelect(e, p);
        break;
      case 'rectangle':
      case 'diamond':
      case 'ellipse': {
        const el = createShape(s.tool, snapped[0], snapped[1], s.style);
        s.setElements([...s.elements, el]);
        this.mode = { kind: 'shape', id: el.id, origin: snapped };
        break;
      }
      case 'line':
      case 'arrow': {
        const el = createLinear(s.tool, snapped[0], snapped[1], s.style);
        s.setElements([...s.elements, el]);
        this.mode = { kind: 'linear-new', id: el.id, downX: e.clientX, downY: e.clientY };
        break;
      }
      case 'freedraw': {
        const el = createFreedraw(p[0], p[1], s.style, e.pointerType !== 'pen');
        const points: FreedrawPoint[] = [[p[0], p[1], e.pressure || 0.5]];
        s.setElements([...s.elements, withFreedrawPoints(el, points)]);
        this.mode = { kind: 'freedraw', id: el.id, points };
        break;
      }
      case 'text':
        this.textAt(p);
        if (!s.toolLocked) store().set({ tool: 'select' });
        break;
      case 'eraser':
        s.set({ erasing: new Set() });
        this.mode = { kind: 'erase', last: p };
        this.eraseAlong(p, p);
        break;
    }
  };

  private downSelect(e: PointerEvent, p: Point) {
    const s = store();
    const handle = this.handleAt(p);
    if (handle?.type === 'frame') {
      const starts = this.selected();
      if (handle.name === 'rotate') {
        const pivot: Point = [
          handle.frame.x + handle.frame.width / 2,
          handle.frame.y + handle.frame.height / 2,
        ];
        this.mode = {
          kind: 'rotate',
          pivot,
          startAngle: Math.atan2(p[1] - pivot[1], p[0] - pivot[0]),
          starts,
        };
      } else {
        this.mode = { kind: 'resize', handle: handle.name, starts };
      }
      return;
    }
    if (handle?.type === 'point' || handle?.type === 'mid') {
      let index = handle.index;
      if (handle.type === 'mid') {
        const abs = absolutePoints(handle.el);
        abs.splice(handle.index + 1, 0, p);
        this.update(handle.el.id, (el) => withAbsolutePoints(el as LinearElement, abs));
        index = handle.index + 1;
      }
      this.mode = { kind: 'point', id: handle.el.id, index };
      return;
    }

    const hit = getElementAt(s.elements, p, s.viewport.zoom);
    if (e.shiftKey) {
      if (hit) {
        const members = expandGroups(s.elements, [hit.id]);
        const next = new Set(s.selectedIds);
        const removing = next.has(hit.id);
        for (const id of members) {
          if (removing) next.delete(id);
          else next.add(id);
        }
        s.select(next);
        if (!removing) this.beginDrag(e, p, false);
      } else {
        this.mode = { kind: 'marquee', origin: p, base: new Set(s.selectedIds) };
      }
      return;
    }
    if (hit) {
      if (!s.selectedIds.has(hit.id)) s.select(expandGroups(s.elements, [hit.id]));
      this.beginDrag(e, p, false);
      return;
    }
    if (s.selectedIds.size > 0 && this.insideFrame(p) && !this.selected().some((el) => el.locked)) {
      this.beginDrag(e, p, true);
      return;
    }
    s.select([]);
    this.mode = { kind: 'marquee', origin: p, base: new Set() };
  }

  onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      this.touches.set(e.pointerId, this.screen(e));
      if (this.pinch && this.touches.size === 2) {
        this.updatePinch();
        return;
      }
    }
    const s = store();
    const p = this.world(e);
    this.pointer = p;
    const snapped = this.snapPoint(p);
    const mode = this.mode;

    switch (mode.kind) {
      case 'idle':
        this.updateCursor(p);
        break;
      case 'pan': {
        const { zoom, scrollX, scrollY } = s.viewport;
        s.setViewport({
          scrollX: scrollX + (e.clientX - mode.lastX) / zoom,
          scrollY: scrollY + (e.clientY - mode.lastY) / zoom,
        });
        mode.lastX = e.clientX;
        mode.lastY = e.clientY;
        break;
      }
      case 'shape':
        this.update(mode.id, (el) => sizeShape(el, mode.origin, snapped, e));
        break;
      case 'freedraw': {
        const events = e.getCoalescedEvents?.() ?? [];
        for (const ev of events.length ? events : [e]) {
          const q = this.world(ev);
          mode.points.push([q[0], q[1], ev.pressure || 0.5]);
        }
        this.update(mode.id, (el) => withFreedrawPoints(el as FreedrawElement, mode.points));
        break;
      }
      case 'linear-new':
      case 'multipoint':
        this.moveLastVertex(mode.id, snapped, e.shiftKey);
        break;
      case 'erase':
        this.eraseAlong(mode.last, p);
        mode.last = p;
        break;
      case 'marquee':
        this.updateMarquee(mode.origin, p, mode.base);
        break;
      case 'drag':
        this.updateDrag(mode, e, p);
        break;
      case 'resize':
        this.updateResize(mode, snapped, e);
        break;
      case 'rotate':
        this.updateRotate(mode, p, e);
        break;
      case 'point':
        this.updatePoint(mode, snapped, e);
        break;
    }
  };

  onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId);
      if (this.pinch) {
        if (this.touches.size < 2) this.pinch = null;
        return;
      }
    }
    const s = store();
    const mode = this.mode;
    switch (mode.kind) {
      case 'idle':
      case 'multipoint':
        return;
      case 'pan':
        s.set({ cursor: s.tool === 'hand' || this.spaceDown ? 'grab' : 'default' });
        break;
      case 'shape': {
        const el = this.find(mode.id);
        if (!el || el.width < 2 || el.height < 2) {
          s.revert();
        } else {
          s.commit();
          this.toolDone([mode.id]);
        }
        break;
      }
      case 'freedraw':
        // Traço livre mantém a ferramenta ativa, como uma caneta na mão.
        s.commit();
        break;
      case 'linear-new': {
        const dragged = Math.hypot(e.clientX - mode.downX, e.clientY - mode.downY) > 5;
        if (dragged) {
          this.mode = { kind: 'idle' };
          this.finishLinear(mode.id);
        } else {
          this.mode = { kind: 'multipoint', id: mode.id };
        }
        return;
      }
      case 'erase':
        if (s.erasing.size > 0) {
          s.setElements(removeElements(s.elements, s.erasing));
          s.commit();
        }
        s.set({ erasing: new Set() });
        break;
      case 'marquee':
        s.set({ marquee: null });
        break;
      case 'drag':
        if (mode.moved) s.commit();
        else if (mode.clearOnClick) s.select([]);
        break;
      case 'resize':
      case 'rotate':
        s.commit();
        break;
      case 'point':
        this.finishPoint(mode);
        break;
    }
    this.mode = { kind: 'idle' };
  };

  onPointerCancel = (e: PointerEvent) => {
    this.touches.delete(e.pointerId);
    this.pinch = null;
    this.cancelGesture();
  };

  private cancelGesture() {
    const s = store();
    if (this.mode.kind !== 'idle') s.revert();
    s.set({ marquee: null, bindTargetId: null, erasing: new Set() });
    this.mode = { kind: 'idle' };
  }

  private pinchState() {
    const [a, b] = [...this.touches.values()];
    return {
      distance: distance(a, b),
      center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Point,
    };
  }

  private updatePinch() {
    if (!this.pinch) return;
    const s = store();
    const next = this.pinchState();
    const v = s.viewport;
    s.setViewport({
      scrollX: v.scrollX + (next.center[0] - this.pinch.center[0]) / v.zoom,
      scrollY: v.scrollY + (next.center[1] - this.pinch.center[1]) / v.zoom,
    });
    if (this.pinch.distance > 0) {
      s.zoomAt(store().viewport.zoom * (next.distance / this.pinch.distance), next.center[0], next.center[1]);
    }
    this.pinch = next;
  }

  private updateCursor(p: Point) {
    const s = store();
    let cursor = 'default';
    if (this.spaceDown || s.tool === 'hand') cursor = 'grab';
    else if (s.tool === 'eraser') cursor = 'cell';
    else if (s.tool === 'text') cursor = 'text';
    else if (s.tool !== 'select') {
      cursor = 'crosshair';
      if (s.tool === 'arrow') {
        const target = findBindable(s.elements, p, null, s.viewport.zoom);
        const id = target?.id ?? null;
        if (id !== s.bindTargetId) s.set({ bindTargetId: id });
      }
    } else {
      const handle = this.handleAt(p);
      if (handle?.type === 'frame') cursor = handleCursor(handle.name, handle.frame.angle);
      else if (handle) cursor = 'pointer';
      else if (getElementAt(s.elements, p, s.viewport.zoom) || (s.selectedIds.size > 0 && this.insideFrame(p))) {
        cursor = 'move';
      }
    }
    if (cursor !== s.cursor) s.set({ cursor });
  }

  private moveLastVertex(id: string, target: Point, shift: boolean) {
    const s = store();
    const el = this.find(id);
    if (!el || !isLinear(el)) return;
    const abs = absolutePoints(el);
    const last = abs.length - 1;
    abs[last] = shift ? snapAngle(abs[last - 1], target) : target;
    this.update(id, (cur) => withAbsolutePoints(cur as LinearElement, abs));
    if (el.type === 'arrow') {
      const bind = findBindable(s.elements, abs[last], id, s.viewport.zoom);
      s.set({ bindTargetId: bind?.id ?? null });
    }
  }

  private addMultipointVertex(p: Point) {
    if (this.mode.kind !== 'multipoint') return;
    const id = this.mode.id;
    const el = this.find(id);
    if (!el || !isLinear(el)) return;
    const abs = absolutePoints(el);
    const previous = abs[abs.length - 2];
    if (distance(previous, p) * store().viewport.zoom < 8) {
      this.finishMultipoint();
      return;
    }
    abs[abs.length - 1] = p;
    abs.push(p);
    this.update(id, (cur) => withAbsolutePoints(cur as LinearElement, abs));
  }

  /** Encerra a linha de vários pontos descartando o vértice de pré-visualização. */
  finishMultipoint(): boolean {
    if (this.mode.kind !== 'multipoint') return false;
    const id = this.mode.id;
    this.mode = { kind: 'idle' };
    const el = this.find(id);
    if (el && isLinear(el)) {
      const abs = absolutePoints(el).slice(0, -1);
      if (abs.length >= 2) this.update(id, (cur) => withAbsolutePoints(cur as LinearElement, abs));
      else {
        store().revert();
        store().set({ bindTargetId: null });
        return true;
      }
    }
    this.finishLinear(id);
    return true;
  }

  private finishLinear(id: string) {
    const s = store();
    this.lastFinish = performance.now();
    const el = this.find(id);
    s.set({ bindTargetId: null });
    if (!el || !isLinear(el) || (el.width < 2 && el.height < 2)) {
      s.revert();
      return;
    }
    if (el.type === 'arrow') {
      const abs = absolutePoints(el);
      const zoom = s.viewport.zoom;
      const start = findBindable(s.elements, abs[0], id, zoom);
      const end = findBindable(s.elements, abs[abs.length - 1], id, zoom);
      this.update(id, (cur) => ({
        ...cur,
        startBinding: start?.id ?? null,
        endBinding: end?.id ?? null,
      }));
      store().setElements(updateBindings(store().elements, new Set([id])));
    }
    store().commit();
    this.toolDone([id]);
  }

  private eraseAlong(a: Point, b: Point) {
    const s = store();
    const threshold = 6 / s.viewport.zoom;
    const steps = Math.max(1, Math.ceil((distance(a, b) * s.viewport.zoom) / 6));
    const hits = new Set(s.erasing);
    const before = hits.size;
    for (let i = 0; i <= steps; i++) {
      const q: Point = [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps];
      for (const el of s.elements) {
        if (!el.locked && !hits.has(el.id) && hitElement(el, q, threshold)) hits.add(el.id);
      }
    }
    if (hits.size !== before) s.set({ erasing: expandGroups(s.elements, hits) });
  }

  private updateMarquee(origin: Point, p: Point, base: Set<string>) {
    const s = store();
    const x = Math.min(origin[0], p[0]);
    const y = Math.min(origin[1], p[1]);
    const width = Math.abs(p[0] - origin[0]);
    const height = Math.abs(p[1] - origin[1]);
    const box = { minX: x, minY: y, maxX: x + width, maxY: y + height };
    const inside = s.elements.filter((el) => {
      if (el.locked) return false;
      const b = getCommonBounds([el]);
      return !!b && b.minX >= box.minX && b.minY >= box.minY && b.maxX <= box.maxX && b.maxY <= box.maxY;
    });
    s.set({
      marquee: { x, y, width, height },
      selectedIds: expandGroups(s.elements, [...base, ...inside.map((el) => el.id)]),
    });
  }

  private updateDrag(mode: Extract<Mode, { kind: 'drag' }>, e: PointerEvent, p: Point) {
    const s = store();
    if (!mode.moved) {
      if (Math.hypot(e.clientX - mode.downX, e.clientY - mode.downY) < DRAG_THRESHOLD) return;
      mode.moved = true;
      // Setas arrastadas sozinhas soltam das formas que não vão junto.
      for (const [id, el] of mode.starts) {
        if (!isLinear(el)) continue;
        mode.starts.set(id, {
          ...el,
          startBinding: el.startBinding && mode.starts.has(el.startBinding) ? el.startBinding : null,
          endBinding: el.endBinding && mode.starts.has(el.endBinding) ? el.endBinding : null,
        });
      }
      if (e.altKey && !mode.duplicated) {
        mode.duplicated = true;
        const clones = cloneElements([...mode.starts.values()], 0, 0);
        const first = s.elements.findIndex((el) => mode.starts.has(el.id));
        s.setElements([...s.elements.slice(0, first), ...clones, ...s.elements.slice(first)]);
      }
    }
    let dx = p[0] - mode.origin[0];
    let dy = p[1] - mode.origin[1];
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    if (s.grid) {
      const first = mode.starts.values().next().value;
      if (first) {
        dx = snapToGrid(first.x + dx) - first.x;
        dy = snapToGrid(first.y + dy) - first.y;
      }
    }
    const current = store().elements;
    store().setElements(
      updateBindings(
        current.map((el) => {
          const start = mode.starts.get(el.id);
          return start ? translate(start, dx, dy) : el;
        }),
        new Set(mode.starts.keys()),
      ),
    );
  }

  private replaceFrom(results: SceneElement[]) {
    const s = store();
    const byId = new Map(results.map((el) => [el.id, el]));
    s.setElements(
      updateBindings(
        s.elements.map((el) => byId.get(el.id) ?? el),
        new Set(byId.keys()),
      ),
    );
  }

  private updateResize(mode: Extract<Mode, { kind: 'resize' }>, p: Point, e: PointerEvent) {
    if (mode.starts.length === 1) {
      this.replaceFrom([
        resizeElement(mode.starts[0], mode.handle, p, {
          keepAspect: e.shiftKey,
          fromCenter: e.altKey,
        }),
      ]);
    } else {
      this.replaceFrom(resizeElements(mode.starts, mode.handle, p, e.shiftKey));
    }
  }

  private updateRotate(mode: Extract<Mode, { kind: 'rotate' }>, p: Point, e: PointerEvent) {
    let delta = Math.atan2(p[1] - mode.pivot[1], p[0] - mode.pivot[0]) - mode.startAngle;
    if (e.shiftKey) {
      const step = Math.PI / 12;
      const base = mode.starts.length === 1 ? mode.starts[0].angle : 0;
      delta = Math.round((base + delta) / step) * step - base;
    }
    this.replaceFrom(rotateElements(mode.starts, mode.pivot, delta));
    store().set({ cursor: 'grabbing' });
  }

  private updatePoint(mode: Extract<Mode, { kind: 'point' }>, p: Point, e: PointerEvent) {
    const s = store();
    const el = this.find(mode.id);
    if (!el || !isLinear(el)) return;
    const abs = absolutePoints(el);
    const neighbour = abs[mode.index === 0 ? 1 : mode.index - 1];
    abs[mode.index] = e.shiftKey ? snapAngle(neighbour, p) : p;
    const isStart = mode.index === 0;
    const isEnd = mode.index === abs.length - 1;
    this.update(mode.id, (cur) => ({
      ...withAbsolutePoints(cur as LinearElement, abs),
      startBinding: isStart ? null : (cur as LinearElement).startBinding,
      endBinding: isEnd ? null : (cur as LinearElement).endBinding,
    }));
    if (el.type === 'arrow' && (isStart || isEnd)) {
      const bind = findBindable(s.elements, abs[mode.index], mode.id, s.viewport.zoom);
      s.set({ bindTargetId: bind?.id ?? null });
    }
  }

  private finishPoint(mode: Extract<Mode, { kind: 'point' }>) {
    const s = store();
    const target = s.bindTargetId;
    s.set({ bindTargetId: null });
    if (target) {
      const el = this.find(mode.id);
      if (el && isLinear(el)) {
        const key = mode.index === 0 ? 'startBinding' : 'endBinding';
        this.update(mode.id, (cur) => ({ ...cur, [key]: target }));
        store().setElements(updateBindings(store().elements, new Set([mode.id])));
      }
    }
    store().commit();
  }

  onDoubleClick = (e: MouseEvent) => {
    const s = store();
    if (s.tool !== 'select' || this.mode.kind !== 'idle') return;
    if (performance.now() - this.lastFinish < 400) return;
    const p = this.world(e);
    const handle = this.handleAt(p);
    if (handle?.type === 'point') {
      const abs = absolutePoints(handle.el);
      if (abs.length > 2) {
        abs.splice(handle.index, 1);
        this.update(handle.el.id, (el) => withAbsolutePoints(el as LinearElement, abs));
        store().setElements(updateBindings(store().elements, new Set([handle.el.id])));
        store().commit();
      }
      return;
    }
    const hit = getElementAt(s.elements, p, s.viewport.zoom);
    if (hit && isLinear(hit)) return;
    if (hit && hit.type !== 'text' && !isShape(hit)) return;
    this.textAt(p);
  };

  onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const s = store();
    if (this.finishMultipoint()) return;
    const p = this.world(e);
    const hit = getElementAt(s.elements, p, s.viewport.zoom, true);
    if (hit && !s.selectedIds.has(hit.id)) s.select(expandGroups(s.elements, [hit.id]));
    if (!hit && !this.insideFrame(p)) s.select([]);
    s.set({ contextMenu: { x: e.clientX, y: e.clientY } });
  };

  onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const s = store();
    const { zoom, scrollX, scrollY } = s.viewport;
    if (e.ctrlKey || e.metaKey) {
      const [x, y] = this.screen(e);
      // Limita o passo: um clique de roda envia ~100, um gesto de trackpad bem menos.
      const delta = Math.max(-25, Math.min(25, e.deltaY));
      s.zoomAt(zoom * Math.exp(-delta * 0.01), x, y);
      return;
    }
    const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
    const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
    s.setViewport({ scrollX: scrollX - dx / zoom, scrollY: scrollY - dy / zoom });
  };

  setSpace(down: boolean) {
    this.spaceDown = down;
    if (this.mode.kind === 'idle') store().set({ cursor: down ? 'grab' : 'default' });
  }

  /** Esc: interrompe o gesto atual. Retorna true se havia algo para interromper. */
  cancel(): boolean {
    if (this.finishMultipoint()) return true;
    if (this.mode.kind !== 'idle') {
      this.cancelGesture();
      return true;
    }
    return false;
  }

  get busy() {
    return this.mode.kind !== 'idle';
  }
}

function sizeShape(el: SceneElement, origin: Point, p: Point, e: PointerEvent): SceneElement {
  let dx = p[0] - origin[0];
  let dy = p[1] - origin[1];
  if (e.shiftKey) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * size;
    dy = Math.sign(dy || 1) * size;
  }
  if (e.altKey) {
    return {
      ...el,
      x: origin[0] - Math.abs(dx),
      y: origin[1] - Math.abs(dy),
      width: Math.abs(dx) * 2,
      height: Math.abs(dy) * 2,
    };
  }
  return {
    ...el,
    x: Math.min(origin[0], origin[0] + dx),
    y: Math.min(origin[1], origin[1] + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

