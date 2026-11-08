import { saveSceneFile, openSceneFile } from '../io/file';
import type { Tool } from '../model/types';
import {
  copySelection,
  deleteSelected,
  duplicateSelected,
  finishEditing,
  groupSelected,
  insertImage,
  layerSelected,
  pasteText,
  selectAll,
  selectedElements,
  toggleGrid,
  toggleLockSelected,
  toggleTheme,
  ungroupSelected,
  zoomBy,
  zoomReset,
  zoomToFit,
} from '../store/commands';
import { useStore } from '../store/store';
import { translate } from '../scene/operations';
import { updateBindings } from '../scene/binding';
import type { InteractionController } from './controller';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  '1': 'select',
  r: 'rectangle',
  '2': 'rectangle',
  d: 'diamond',
  '3': 'diamond',
  o: 'ellipse',
  '4': 'ellipse',
  a: 'arrow',
  '5': 'arrow',
  l: 'line',
  '6': 'line',
  p: 'freedraw',
  '7': 'freedraw',
  t: 'text',
  '8': 'text',
  e: 'eraser',
  '0': 'eraser',
  h: 'hand',
};

export const pickImage = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.onchange = () => {
    if (input.files?.[0]) void insertImage(input.files[0]);
  };
  input.click();
};

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function nudge(dx: number, dy: number) {
  const s = useStore.getState();
  if (s.selectedIds.size === 0) return;
  s.setElements(
    updateBindings(
      s.elements.map((el) => (s.selectedIds.has(el.id) && !el.locked ? translate(el, dx, dy) : el)),
      s.selectedIds,
    ),
  );
  s.commit();
}

/** Registra atalhos e área de transferência; devolve a função de limpeza. */
export function bindKeyboard(controller: InteractionController): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const s = useStore.getState();
    if (isTyping(e.target)) return;
    if (s.dialog !== 'none') {
      if (e.key === 'Escape') s.set({ dialog: 'none' });
      return;
    }
    const key = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;

    if (mod) {
      const handlers: Record<string, () => void> = {
        z: () => (e.shiftKey ? s.redo() : s.undo()),
        y: () => s.redo(),
        a: selectAll,
        d: duplicateSelected,
        s: saveSceneFile,
        o: () => openSceneFile(),
        '=': () => zoomBy(1.2),
        '+': () => zoomBy(1.2),
        '-': () => zoomBy(1 / 1.2),
        '0': zoomReset,
        "'": toggleGrid,
        ']': () => layerSelected(e.altKey ? 'front' : 'forward'),
        '[': () => layerSelected(e.altKey ? 'back' : 'backward'),
        g: () => (e.shiftKey ? ungroupSelected() : groupSelected()),
        l: () => e.shiftKey && toggleLockSelected(),
        e: () => e.shiftKey && s.set({ dialog: 'export' }),
      };
      const handler = handlers[key];
      if (handler) {
        e.preventDefault();
        handler();
      }
      return;
    }

    if (e.altKey && e.shiftKey && key === 'd') {
      e.preventDefault();
      toggleTheme();
      return;
    }

    if (e.shiftKey && (e.code === 'Digit1' || e.code === 'Digit2')) {
      zoomToFit(e.code === 'Digit2' ? selectedElements() : undefined);
      return;
    }

    if (e.key === '?') {
      s.set({ dialog: 'help' });
      return;
    }

    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        controller.setSpace(true);
        return;
      case 'Escape':
        if (!controller.cancel()) {
          s.select([]);
          s.setTool('select');
          s.set({ contextMenu: null });
        }
        return;
      case 'Enter':
        if (controller.finishMultipoint()) return;
        if (s.selectedIds.size === 1) {
          const [el] = selectedElements();
          if (el.type === 'text' || 'label' in el) {
            e.preventDefault();
            s.set({ editing: { id: el.id, kind: el.type === 'text' ? 'text' : 'label' } });
          }
        }
        return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        deleteSelected();
        return;
      case 'ArrowLeft':
        e.preventDefault();
        nudge(-step, 0);
        return;
      case 'ArrowRight':
        e.preventDefault();
        nudge(step, 0);
        return;
      case 'ArrowUp':
        e.preventDefault();
        nudge(0, -step);
        return;
      case 'ArrowDown':
        e.preventDefault();
        nudge(0, step);
        return;
    }

    if (key === 'i' || key === '9') {
      pickImage();
      return;
    }
    if (key === 'q') {
      s.set({ toolLocked: !s.toolLocked });
      return;
    }
    const tool = TOOL_KEYS[key];
    if (tool && !controller.busy) s.setTool(tool);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ') controller.setSpace(false);
  };

  const onCopy = (e: ClipboardEvent, cut = false) => {
    if (isTyping(e.target)) return;
    const text = copySelection();
    if (!text) return;
    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
    if (cut) deleteSelected();
  };
  const onCut = (e: ClipboardEvent) => onCopy(e, true);

  const onPaste = (e: ClipboardEvent) => {
    if (isTyping(e.target)) return;
    finishEditing();
    const image = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (image) {
      e.preventDefault();
      void insertImage(image, controller.pointer);
      return;
    }
    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      e.preventDefault();
      pasteText(text, controller.pointer);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('copy', onCopy);
  document.addEventListener('cut', onCut);
  document.addEventListener('paste', onPaste);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('cut', onCut);
    document.removeEventListener('paste', onPaste);
  };
}
