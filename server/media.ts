import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Media } from '../shared/types.ts';
import { DATA_DIR } from '../shared/paths.ts';
import { referencedMediaIds } from '../shared/media-references.ts';
import { getSnapshot, saveSnapshot, HttpError } from './store.ts';
export async function uploadMedia(file: Express.Multer.File | undefined) {
  if (!file) throw new HttpError(400, 'Choose an image to upload.');
  const snapshot = getSnapshot();
  if (snapshot.media.length >= 5000) throw new HttpError(400, 'Media library limit reached.');
  let normalized: Buffer, width: number, height: number;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: 'error' }),
      metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp', 'gif', 'avif'].includes(metadata.format || '') ||
      (metadata.pages && metadata.pages > 1)
    )
      throw new Error();
    const result = await image
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    normalized = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch {
    throw new HttpError(
      400,
      'Upload a valid, non-animated JPEG, PNG, WebP or AVIF image (up to 40 megapixels).',
    );
  }
  const id = randomUUID(),
    filename = `${id}.webp`,
    media: Media = {
      id,
      filename,
      path: `/media/${filename}`,
      width,
      height,
      alt: { 'zh-CN': '', en: '', fr: '' },
      caption: { 'zh-CN': '', en: '', fr: '' },
    };
  await mkdir(join(DATA_DIR, 'media'), { recursive: true });
  const path = join(DATA_DIR, 'media', filename);
  await writeFile(path, normalized, { flag: 'wx' });
  // Re-read after processing so uploads don't overwrite edits made meanwhile.
  const current = getSnapshot();
  current.media.push(media);
  try {
    return { snapshot: saveSnapshot(current), media };
  } catch (error) {
    await unlink(path).catch(() => {});
    throw error;
  }
}
export async function deleteMedia(id: string) {
  const snapshot = getSnapshot(),
    media = snapshot.media.find((m) => m.id === id);
  if (!media) throw new HttpError(404, 'Image not found.');
  const serialized = JSON.stringify({ settings: snapshot.settings, entries: snapshot.entries });
  if (
    referencedMediaIds(snapshot, false).has(id) ||
    serialized.includes(media.path) ||
    serialized.includes(media.filename) ||
    serialized.includes(encodeURIComponent(media.filename))
  )
    throw new HttpError(
      409,
      'This image is still referenced by a profile, cover, or content. Remove those references first.',
    );
  snapshot.media = snapshot.media.filter((m) => m.id !== id);
  const saved = saveSnapshot(snapshot);
  await unlink(join(DATA_DIR, 'media', media.filename)).catch(() => {});
  return saved;
}
