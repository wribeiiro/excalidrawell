const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_DIMENSION = 2048;

export const isSafeImageUrl = (url: unknown): url is string =>
  typeof url === 'string' && /^data:image\/(png|jpeg|webp|gif)[;,]/.test(url);

/** Reduz a imagem para no máximo 2048 px e a recodifica, descartando metadados. */
export async function readImageFile(
  file: File,
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Use uma imagem PNG, JPEG, WebP ou GIF.');
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { dataUrl: canvas.toDataURL('image/webp', 0.92), width, height };
}
