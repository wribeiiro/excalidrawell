import { get, set } from 'idb-keyval';
import { DEFAULT_STYLE } from '../model/elements';
import type { SceneElement, SceneFiles, StyleDefaults, Viewport } from '../model/types';
import { showToast, useStore } from '../store/store';
import type { Theme } from '../store/store';
import { restoreElements, restoreFiles } from './scene';

const KEY = 'excalidrawell:scene:v1';
const SAVE_DELAY = 400;

interface Saved {
  elements: SceneElement[];
  files: SceneFiles;
  viewport: Viewport;
  style: StyleDefaults;
  theme: Theme;
  grid: boolean;
}

async function save() {
  const { elements, files, viewport, style, theme, grid } = useStore.getState();
  try {
    await set(KEY, { elements, files, viewport, style, theme, grid } satisfies Saved);
  } catch {
    showToast('O navegador não permitiu salvar o quadro. Salve em arquivo para não perder.');
  }
}

/** Restaura o último quadro e passa a salvar automaticamente. */
export async function startPersistence() {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  try {
    const saved = (await get(KEY)) as Partial<Saved> | undefined;
    if (saved) {
      const files = restoreFiles(saved.files);
      const viewport = saved.viewport;
      useStore.getState().loadScene({
        elements: restoreElements(saved.elements, files),
        files,
        viewport:
          viewport && Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport : undefined,
        style: { ...DEFAULT_STYLE, ...saved.style },
        theme: saved.theme,
        grid: saved.grid === true,
      });
    } else if (prefersDark) {
      useStore.setState({ theme: 'dark' });
    }
  } catch {
    showToast('Não foi possível restaurar o último quadro.');
  }
  useStore.setState({ hydrated: true });

  let timer = 0;
  useStore.subscribe((state, previous) => {
    if (
      state.elements === previous.elements &&
      state.files === previous.files &&
      state.viewport === previous.viewport &&
      state.style === previous.style &&
      state.theme === previous.theme &&
      state.grid === previous.grid
    ) {
      return;
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(save, SAVE_DELAY);
  });
  window.addEventListener('pagehide', () => void save());
}
