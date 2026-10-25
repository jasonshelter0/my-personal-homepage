import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { seed } from '../shared/seed.ts';
import { parseSnapshot } from '../server/schema.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({
  options: {
    output: { type: 'string' },
    snapshot: { type: 'string' },
    'media-dir': { type: 'string' },
    'site-url': { type: 'string', default: 'https://www.jasonshelter.com' },
  },
});
if (!values.output) throw new Error('Pass --output with a new artifact directory.');
const output = path.resolve(values.output);
if (fs.existsSync(output)) throw new Error('Output already exists; use a new directory.');
const site = new URL(values['site-url']!);
if (
  site.protocol !== 'https:' ||
  site.pathname !== '/' ||
  site.username ||
  site.password ||
  site.search ||
  site.hash
)
  throw new Error('--site-url must be an HTTPS origin.');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const data = path.join(output, 'data');
// Select a fresh database before importing any stateful modules. Development
// credentials and sessions must never be copied into production.
process.env.FOLIO_DATA_DIR = data;
process.env.SERVE_PUBLIC = 'true';
process.env.PREVIEW_BASE_PATH = '/preview';
process.env.PUBLIC_ORIGIN = site.origin;
const snapshot = parseSnapshot(
  values.snapshot
    ? JSON.parse(fs.readFileSync(path.resolve(values.snapshot), 'utf8'))
    : structuredClone(seed),
);
snapshot.settings.siteUrl = site.origin;
snapshot.entries = snapshot.entries.filter((e) => e.status === 'published');
const { referencedMediaIds } = await import('../shared/media-references.ts');
const ids = referencedMediaIds(snapshot);
snapshot.media = snapshot.media.filter((m) => ids.has(m.id));
fs.mkdirSync(path.join(data, 'media'), { recursive: true });
for (const media of snapshot.media) {
  const candidates = [
    ...(values['media-dir'] ? [path.join(path.resolve(values['media-dir']), media.filename)] : []),
    path.join(ROOT, 'apps/site/public/media', media.filename),
  ];
  const source = candidates.find((p) => fs.existsSync(p));
  if (!source) throw new Error(`Missing referenced media: ${media.filename}`);
  fs.copyFileSync(source, path.join(data, 'media', media.filename));
}
const { getSnapshot, saveSnapshot } = await import('../server/store.ts');
const stored = saveSnapshot(snapshot, getSnapshot().revision);
const { createRelease, waitForBuilds, listReleases, releaseDirectory, previewDirectory } =
  await import('../server/publisher.ts');
const release = await createRelease(stored);
await waitForBuilds();
const ready = listReleases().find((r) => r.id === release.id)!;
if (ready.status !== 'ready')
  throw new Error(ready.error || 'Production build did not become ready.');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const manifest = {
  version,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  createdAt: new Date().toISOString(),
  siteUrl: site.origin,
  releaseId: release.id,
  dataDirectory: data,
  publicDirectory: releaseDirectory(release.id),
  previewDirectory: previewDirectory(release.id),
  status: 'ready_for_review',
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
console.log(
  'Review the authenticated preview, publish it, and remove temporary review sessions before packaging data.',
);
