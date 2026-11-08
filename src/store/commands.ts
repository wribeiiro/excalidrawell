import { nanoid } from 'nanoid';
import { createImage, createText } from '../model/elements';
import type { Point, SceneElement } from '../model/types';
import { isShape } from '../model/types';
import { getCommonBounds } from '../math/geometry';
import { readImageFile } from '../io/images';
import { measureText } from '../render/text';
import { updateBindings } from '../scene/binding';
import type { Align, Layer } from '../scene/operations';
import { align, cloneElements, distribute, removeElements, reorder } from '../scene/operations';
import { expandGroups, getSelected } from '../scene/selection';
import { showToast, useStore } from './store';

const CLIPBOARD_TYPE = 'excalidrawell/clipboard';
const state = () => useStore.getState();

export const selectedElements = () => getSelected(state().elements, state().selectedIds);

function apply(elements: SceneElement[], selection?: Iterable<string>) {
  const s = state();
  s.setElements(elements);
  if (selection) s.select(selection);
  s.commit();
}

export const selectAll = () => {
  const s = state();
  s.setTool('select');
  s.select(s.elements.filter((el) => !el.locked).map((el) => el.id));
};

export const deleteSelected = () => {
  const s = state();
  if (s.selectedIds.size === 0) return;
  apply(removeElements(s.elements, s.selectedIds), []);
};

export const duplicateSelected = () => {
  const s = state();
  const source = selectedElements();
  if (source.length === 0) return;
  const clones = cloneElements(source, 16, 16);
  apply([...s.elements, ...clones], clones.map((el) => el.id));
};

export const groupSelected = () => {
  const s = state();
  if (s.selectedIds.size < 2) return;
  const groupId = nanoid();
  apply(s.elements.map((el) => (s.selectedIds.has(el.id) ? { ...el, groupId } : el)));
};

export const ungroupSelected = () => {
  const s = state();
  apply(s.elements.map((el) => (s.selectedIds.has(el.id) ? { ...el, groupId: null } : el)));
};

export const layerSelected = (layer: Layer) => {
  const s = state();
  if (s.selectedIds.size > 0) apply(reorder(s.elements, s.selectedIds, layer));
};

export const alignSelected = (kind: Align) => apply(align(state().elements, selectedElements(), kind));

export const distributeSelected = (axis: 'x' | 'y') =>
  apply(distribute(state().elements, selectedElements(), axis));

export const toggleLockSelected = () => {
  const s = state();
  const selected = selectedElements();
  if (selected.length === 0) return;
  const locked = !selected.every((el) => el.locked);
  apply(s.elements.map((el) => (s.selectedIds.has(el.id) ? { ...el, locked } : el)));
};

export const toggleTheme = () =>
  state().set({ theme: state().theme === 'dark' ? 'light' : 'dark' });
export const toggleGrid = () => state().set({ grid: !state().grid });

export const screenCenter = (): Point => {
  const { viewport } = state();
  return [
    window.innerWidth / 2 / viewport.zoom - viewport.scrollX,
    window.innerHeight / 2 / viewport.zoom - viewport.scrollY,
  ];
};

export const zoomBy = (factor: number) =>
  state().zoomAt(state().viewport.zoom * factor, window.innerWidth / 2, window.innerHeight / 2);
export const zoomReset = () =>
  state().zoomAt(1, window.innerWidth / 2, window.innerHeight / 2);

/** Enquadra os elementos informados, ou a cena inteira. */
export function zoomToFit(target?: readonly SceneElement[]) {
  const s = state();
  const b = getCommonBounds(target ?? s.elements);
  if (!b) return;
  const pad = 96;
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const zoom = Math.max(
    0.1,
    Math.min(2, Math.min((window.innerWidth - pad * 2) / w, (window.innerHeight - pad * 2) / h)),
  );
  s.setViewport({
    zoom,
    scrollX: window.innerWidth / 2 / zoom - (b.minX + w / 2),
    scrollY: window.innerHeight / 2 / zoom - (b.minY + h / 2),
  });
}

export function startEditing(id: string) {
  const s = state();
  const el = s.elements.find((e) => e.id === id);
  if (!el || el.locked) return;
  if (el.type !== 'text' && !isShape(el)) return;
  s.select([id]);
  s.set({ editing: { id, kind: el.type === 'text' ? 'text' : 'label' } });
}

/** Atualiza o texto em edição mantendo a âncora conforme o alinhamento. */
export function updateEditingText(value: string) {
  const s = state();
  if (!s.editing) return;
  const id = s.editing.id;
  s.setElements(
    updateBindings(
      s.elements.map((el) => {
        if (el.id !== id) return el;
        if (isShape(el)) return { ...el, label: value };
        if (el.type !== 'text') return el;
        const { width, height } = measureText(value, el.fontSize, el.fontFamily);
        const shift =
          el.textAlign === 'center' ? (el.width - width) / 2 : el.textAlign === 'right' ? el.width - width : 0;
        return { ...el, text: value, width, height, x: el.x + shift };
      }),
      new Set([id]),
    ),
  );
}

export function finishEditing() {
  const s = state();
  if (!s.editing) return;
  const el = s.elements.find((e) => e.id === s.editing?.id);
  s.set({ editing: null });
  if (el?.type === 'text' && el.text.trim() === '') {
    s.setElements(removeElements(s.elements, new Set([el.id])));
    s.select([]);
  }
  state().commit();
}

export async function insertImage(file: File, at?: Point) {
  try {
    const { dataUrl, width, height } = await readImageFile(file);
    const s = state();
    const fileId = nanoid();
    s.addFile(fileId, dataUrl);
    const maxWorld = 480 / s.viewport.zoom;
    const scale = Math.min(1, maxWorld / Math.max(width, height));
    const w = width * scale;
    const h = height * scale;
    const [cx, cy] = at ?? screenCenter();
    const el = createImage(cx - w / 2, cy - h / 2, w, h, fileId, s.style);
    s.setTool('select');
    apply([...state().elements, el], [el.id]);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Não foi possível inserir a imagem.');
  }
}

export function copySelection(): string | null {
  const selected = selectedElements();
  if (selected.length === 0) return null;
  const { files } = state();
  const used = Object.fromEntries(
    selected.flatMap((el) => (el.type === 'image' && files[el.fileId] ? [[el.fileId, files[el.fileId]]] : [])),
  );
  return JSON.stringify({ type: CLIPBOARD_TYPE, elements: selected, files: used });
}

export function pasteText(raw: string, at: Point) {
  const s = state();
  try {
    const data = JSON.parse(raw);
    if (data?.type === CLIPBOARD_TYPE && Array.isArray(data.elements) && data.elements.length) {
      const source = data.elements as SceneElement[];
      const b = getCommonBounds(source);
      if (!b) return;
      for (const [id, url] of Object.entries(data.files ?? {})) {
        if (typeof url === 'string' && url.startsWith('data:image/') && !url.startsWith('data:image/svg')) {
          s.addFile(id, url);
        }
      }
      const clones = cloneElements(source, at[0] - (b.minX + b.maxX) / 2, at[1] - (b.minY + b.maxY) / 2);
      s.setTool('select');
      apply(updateBindings([...state().elements, ...clones]), clones.map((el) => el.id));
      return;
    }
  } catch {
    // Não é JSON: segue como texto comum.
  }
  if (!raw.trim()) return;
  const size = measureText(raw, s.style.fontSize, s.style.fontFamily);
  const el = {
    ...createText(at[0] - size.width / 2, at[1] - size.height / 2, s.style, raw),
    ...size,
  };
  s.setTool('select');
  apply([...state().elements, el], [el.id]);
}

export { expandGroups };
