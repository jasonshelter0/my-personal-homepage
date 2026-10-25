/** Build a new application-content release without saving or publishing any draft.
 * Run inside the selected runtime with its existing FOLIO_DATA_DIR.
 * Inspect the authenticated preview, then use the normal publish endpoint.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { DATA_DIR } from '../shared/paths.ts';
import { parseSnapshot } from '../server/schema.ts';
import { referencedMediaIds } from '../shared/media-references.ts';
import {
  getCurrentRelease,
  listReleases,
  createRelease,
  waitForBuilds,
} from '../server/publisher.ts';

const { values } = parseArgs({ options: { 'expected-current': { type: 'string' } } });
const current = getCurrentRelease();
if (!current?.publishedAt) throw new Error('An existing published release is required.');
if (!values['expected-current'] || values['expected-current'] !== current.id)
  throw new Error('Pass --expected-current with the verified live release ID.');
if (listReleases().some((release) => release.status === 'building'))
  throw new Error('Another release is building. Coordinate ownership before proceeding.');
const snapshot = parseSnapshot(
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'releases', current.id, 'snapshot.json'), 'utf8')),
);
const draftEntryIds = new Set(
  snapshot.entries.filter((entry) => entry.status !== 'published').map((entry) => entry.id),
);
snapshot.entries = snapshot.entries.filter((entry) => entry.status === 'published');
// Custom sections may select a draft alongside published cards. That card never
// renders publicly; remove its reference together with the private entry.
for (const section of snapshot.settings.sections)
  if (section.entryIds) section.entryIds = section.entryIds.filter((id) => !draftEntryIds.has(id));
const referenced = referencedMediaIds(snapshot);
snapshot.media = snapshot.media.filter((media) => referenced.has(media.id));
const release = await createRelease(snapshot);
await waitForBuilds();
const ready = listReleases().find((item) => item.id === release.id)!;
if (ready.status !== 'ready')
  throw new Error('Published-content rebuild failed; inspect its restricted build log.');
if (getCurrentRelease()?.id !== current.id)
  throw new Error('Live release changed during build. Do not publish without reconciling it.');
console.log(
  JSON.stringify({
    sourceRelease: current.id,
    id: ready.id,
    status: ready.status,
    previewUrl: ready.previewUrl,
    draftUntouched: true,
  }),
);
