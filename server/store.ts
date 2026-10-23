import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../shared/paths.ts';
import { seed } from '../shared/seed.ts';
import { contentHash } from '../shared/validation.ts';
import { LOCALES, type Snapshot } from '../shared/types.ts';
import { parseSnapshot } from './schema.ts';
mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(join(DATA_DIR, 'studio.sqlite'));
db.exec(
  'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS draft (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, content TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);',
);
db.prepare('INSERT OR IGNORE INTO draft (id, revision, content) VALUES (1, ?, ?)').run(
  seed.revision,
  JSON.stringify(seed),
);
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function getSnapshot(): Snapshot {
  const row = db.prepare('SELECT content FROM draft WHERE id=1').get() as { content: string };
  return JSON.parse(row.content);
}
export function saveSnapshot(snapshot: Snapshot, expectedRevision = snapshot.revision): Snapshot {
  const next = parseSnapshot({ ...snapshot, revision: expectedRevision + 1 });
  const result = db
    .prepare('UPDATE draft SET revision=?, content=? WHERE id=1 AND revision=?')
    .run(next.revision, JSON.stringify(next), expectedRevision);
  if (!result.changes)
    throw new HttpError(
      409,
      'The draft changed. Reload before saving to avoid overwriting newer work.',
    );
  return next;
}
export function updateDraft(input: unknown): Snapshot {
  const next = parseSnapshot(input),
    prev = getSnapshot();
  if (next.revision !== prev.revision)
    throw new HttpError(409, 'The draft changed. Reload before saving.');
  // Uploaded resources are owned by the media endpoint; metadata may be edited here.
  if (
    next.media.length !== prev.media.length ||
    next.media.some((m) => {
      const old = prev.media.find((p) => p.id === m.id);
      return (
        !old ||
        ['filename', 'path', 'width', 'height'].some(
          (k) => m[k as keyof typeof m] !== old[k as keyof typeof m],
        )
      );
    })
  )
    throw new HttpError(400, 'Use the media endpoint to add or remove images.');
  for (const mediaId of [next.settings.avatarId, ...next.entries.map((e) => e.coverId)])
    if (mediaId && !next.media.some((m) => m.id === mediaId))
      throw new HttpError(400, 'Referenced image does not exist.');
  for (const l of LOCALES) {
    const n = next.settings.profile[l],
      p = prev.settings.profile[l];
    n.reviewed =
      p.reviewed &&
      contentHash(n) === contentHash(p) &&
      next.settings.sourceLocale === prev.settings.sourceLocale;
    n.sourceHash = p.sourceHash;
  }
  for (const e of next.entries) {
    const old = prev.entries.find((p) => p.id === e.id);
    for (const l of LOCALES) {
      const n = e.translations[l],
        p = old?.translations[l];
      n.reviewed = Boolean(
        p?.reviewed && contentHash(n) === contentHash(p!) && e.sourceLocale === old?.sourceLocale,
      );
      n.sourceHash = p?.sourceHash ?? '';
    }
  }
  return saveSnapshot(next);
}
export function createSession(token: string, expires: number) {
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  db.prepare('INSERT INTO sessions(token,expires) VALUES (?,?)').run(token, expires);
}
export function validSession(token: string): boolean {
  return !!db
    .prepare('SELECT token FROM sessions WHERE token=? AND expires>?')
    .get(token, Date.now());
}
export function deleteSession(token: string) {
  db.prepare('DELETE FROM sessions WHERE token=?').run(token);
}
