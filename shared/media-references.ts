import type { Snapshot } from './types.ts';

/** Inspect root-relative media URLs without interpreting remote hosts as local assets. */
function localMediaPaths(text: string): Set<string> {
  const paths = new Set<string>();
  // Code examples do not load images. Remove full external URLs before scanning so
  // even a remote URL's query string containing /media/... is not treated as local.
  const content = text
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, ' ')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"'()[\]{}]+|\/\/[^\s<>"'()[\]{}]+/gi, ' ');
  const candidates = content.matchAll(/(?<![a-zA-Z0-9_\/%.-])\/media(?:\/|%2f)[^\s<>"'()[\]{}]+/gi);
  for (const match of candidates) {
    const raw = match[0].split(/[?#]/, 1)[0].replace(/[.,;:!*]+$/, '');
    let path: string;
    try {
      path = decodeURIComponent(raw);
    } catch {
      path = raw;
    }
    // Decode once, matching HTTP pathname decoding; double-encoded paths must not
    // silently resolve to a different image than the browser requests.
    paths.add(path);
  }
  return paths;
}
function references(snapshot: Snapshot, publishedOnly: boolean) {
  const ids = new Set<string>(),
    paths = new Set<string>();
  if (snapshot.settings.avatarId) ids.add(snapshot.settings.avatarId);
  for (const profile of Object.values(snapshot.settings.profile))
    for (const path of localMediaPaths(profile.about)) paths.add(path);
  for (const section of snapshot.settings.sections) {
    if (publishedOnly && !section.enabled) continue;
    for (const body of Object.values(section.body ?? {}))
      for (const path of localMediaPaths(body)) paths.add(path);
  }
  for (const entry of snapshot.entries) {
    if (publishedOnly && entry.status !== 'published') continue;
    if (entry.coverId) ids.add(entry.coverId);
    for (const content of Object.values(entry.translations))
      for (const path of localMediaPaths(content.body)) paths.add(path);
  }
  return { ids, paths };
}
/** IDs referenced by covers, avatar, and inline images; drafts are opt-in. */
export function referencedMediaIds(snapshot: Snapshot, publishedOnly = true): Set<string> {
  const { ids, paths } = references(snapshot, publishedOnly);
  for (const media of snapshot.media) if (paths.has(media.path)) ids.add(media.id);
  return ids;
}
/** Missing published references, represented as local paths or id:<missing-id>. */
export function missingMediaReferences(snapshot: Snapshot): string[] {
  const { ids, paths } = references(snapshot, true);
  const knownIds = new Set(snapshot.media.map((m) => m.id)),
    knownPaths = new Set(snapshot.media.map((m) => m.path));
  return [
    ...[...ids].filter((id) => !knownIds.has(id)).map((id) => `id:${id}`),
    ...[...paths].filter((path) => !knownPaths.has(path)),
  ];
}
