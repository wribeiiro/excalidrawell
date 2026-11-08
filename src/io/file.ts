import { showToast, useStore } from '../store/store';
import { zoomToFit } from '../store/commands';
import { parseScene, serializeScene } from './scene';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function saveSceneFile() {
  const { elements, files } = useStore.getState();
  downloadBlob(
    new Blob([serializeScene(elements, files)], { type: 'application/json' }),
    'quadro.excalidrawell',
  );
  showToast('Quadro salvo em arquivo.');
}

export async function loadSceneFile(file: File) {
  try {
    const scene = parseScene(await file.text());
    useStore.getState().loadScene(scene);
    zoomToFit();
    showToast('Quadro aberto.');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Não foi possível abrir o arquivo.');
  }
}

export function openSceneFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.excalidrawell,.json,application/json';
  input.onchange = () => {
    if (input.files?.[0]) void loadSceneFile(input.files[0]);
  };
  input.click();
}
