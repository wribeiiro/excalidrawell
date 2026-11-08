import { create } from 'zustand';
import { DEFAULT_STYLE } from '../model/elements';
import type {
  SceneElement,
  SceneFiles,
  StyleDefaults,
  Tool,
  Viewport,
} from '../model/types';
import { measureText } from '../render/text';

export type Dialog = 'none' | 'help' | 'export' | 'reset';
export type Theme = 'light' | 'dark';

export interface Editing {
  id: string;
  kind: 'text' | 'label';
}

export interface ContextMenuState {
  x: number;
  y: number;
}

const HISTORY_LIMIT = 200;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 30;

export interface Store {
  elements: SceneElement[];
  files: SceneFiles;
  selectedIds: ReadonlySet<string>;

  /** Pilhas do desfazer. `committed` é o último estado gravado no histórico. */
  past: SceneElement[][];
  future: SceneElement[][];
  committed: SceneElement[];

  tool: Tool;
  toolLocked: boolean;
  viewport: Viewport;
  style: StyleDefaults;
  theme: Theme;
  grid: boolean;

  editing: Editing | null;
  marquee: { x: number; y: number; width: number; height: number } | null;
  bindTargetId: string | null;
  erasing: ReadonlySet<string>;
  dialog: Dialog;
  contextMenu: ContextMenuState | null;
  toast: string | null;
  cursor: string;
  /** Incrementado para forçar novo desenho (fontes e imagens carregadas). */
  renderNonce: number;
  hydrated: boolean;

  setElements: (elements: SceneElement[]) => void;
  commit: () => void;
  revert: () => void;
  undo: () => void;
  redo: () => void;
  select: (ids: Iterable<string>) => void;
  setTool: (tool: Tool) => void;
  setViewport: (patch: Partial<Viewport>) => void;
  zoomAt: (zoom: number, screenX: number, screenY: number) => void;
  applyStyle: (patch: Partial<StyleDefaults>) => void;
  addFile: (id: string, dataUrl: string) => void;
  loadScene: (scene: {
    elements: SceneElement[];
    files: SceneFiles;
    viewport?: Viewport;
    style?: StyleDefaults;
    theme?: Theme;
    grid?: boolean;
  }) => void;
  set: (patch: Partial<Store>) => void;
}

const EMPTY: ReadonlySet<string> = new Set();

function styled(el: SceneElement, patch: Partial<StyleDefaults>): SceneElement {
  const relevant = Object.fromEntries(Object.entries(patch).filter(([key]) => key in el));
  if (Object.keys(relevant).length === 0) return el;
  const next = { ...el, ...relevant } as SceneElement;
  if (next.type === 'text') {
    const { width, height } = measureText(next.text, next.fontSize, next.fontFamily);
    return { ...next, width, height };
  }
  return next;
}

export const useStore = create<Store>((set, get) => ({
  elements: [],
  files: {},
  selectedIds: EMPTY,
  past: [],
  future: [],
  committed: [],
  tool: 'select',
  toolLocked: false,
  viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
  style: DEFAULT_STYLE,
  theme: 'light',
  grid: false,
  editing: null,
  marquee: null,
  bindTargetId: null,
  erasing: EMPTY,
  dialog: 'none',
  contextMenu: null,
  toast: null,
  cursor: 'default',
  renderNonce: 0,
  hydrated: false,

  setElements: (elements) => set({ elements }),

  commit: () => {
    const { elements, committed, past } = get();
    if (elements === committed) return;
    set({
      past: [...past.slice(-(HISTORY_LIMIT - 1)), committed],
      future: [],
      committed: elements,
    });
  },

  revert: () => set((s) => ({ elements: s.committed })),

  undo: () => {
    get().commit();
    const { past, future, committed, selectedIds } = get();
    const previous = past[past.length - 1];
    if (!previous) return;
    const live = new Set(previous.map((el) => el.id));
    set({
      elements: previous,
      committed: previous,
      past: past.slice(0, -1),
      future: [...future, committed],
      selectedIds: new Set([...selectedIds].filter((id) => live.has(id))),
      editing: null,
    });
  },

  redo: () => {
    const { past, future, committed, selectedIds } = get();
    const next = future[future.length - 1];
    if (!next) return;
    const live = new Set(next.map((el) => el.id));
    set({
      elements: next,
      committed: next,
      past: [...past, committed],
      future: future.slice(0, -1),
      selectedIds: new Set([...selectedIds].filter((id) => live.has(id))),
      editing: null,
    });
  },

  select: (ids) => set({ selectedIds: new Set(ids) }),

  setTool: (tool) =>
    set((s) => ({
      tool,
      selectedIds: tool === 'select' ? s.selectedIds : EMPTY,
      bindTargetId: null,
    })),

  setViewport: (patch) => set((s) => ({ viewport: { ...s.viewport, ...patch } })),

  zoomAt: (requested, sx, sy) => {
    const { viewport } = get();
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, requested));
    set({
      viewport: {
        zoom,
        scrollX: viewport.scrollX + sx / zoom - sx / viewport.zoom,
        scrollY: viewport.scrollY + sy / zoom - sy / viewport.zoom,
      },
    });
  },

  applyStyle: (patch) => {
    const { elements, selectedIds, style } = get();
    set({
      style: { ...style, ...patch },
      elements:
        selectedIds.size === 0
          ? elements
          : elements.map((el) => (selectedIds.has(el.id) ? styled(el, patch) : el)),
    });
  },

  addFile: (id, dataUrl) => set((s) => ({ files: { ...s.files, [id]: dataUrl } })),

  loadScene: ({ elements, files, viewport, style, theme, grid }) =>
    set((s) => ({
      elements,
      files,
      committed: elements,
      past: [],
      future: [],
      selectedIds: EMPTY,
      editing: null,
      viewport: viewport ?? s.viewport,
      style: style ?? s.style,
      theme: theme ?? s.theme,
      grid: grid ?? s.grid,
    })),

  set: (patch) => set(patch),
}));

export const showToast = (message: string) => {
  useStore.setState({ toast: message });
  window.setTimeout(() => {
    if (useStore.getState().toast === message) useStore.setState({ toast: null });
  }, 2800);
};
