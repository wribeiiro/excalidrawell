import type { SceneElement, SceneFiles } from '../model/types';

const images = new Map<string, HTMLImageElement>();
let onLoad: () => void = () => {};

export const setImageLoadListener = (fn: () => void) => {
  onLoad = fn;
};

export function getImage(fileId: string, files: SceneFiles): HTMLImageElement | null {
  const cached = images.get(fileId);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const src = files[fileId];
  if (!src) return null;
  const image = new Image();
  image.onload = () => onLoad();
  image.src = src;
  images.set(fileId, image);
  return null;
}

/** Aguarda as imagens usadas; necessário antes de exportar. */
export async function ensureImages(
  elements: readonly SceneElement[],
  files: SceneFiles,
): Promise<void> {
  await Promise.all(
    elements.flatMap((el) => {
      if (el.type !== 'image') return [];
      getImage(el.fileId, files);
      const image = images.get(el.fileId);
      return image ? [image.decode().catch(() => undefined)] : [];
    }),
  );
}
