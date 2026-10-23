import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { DATA_DIR, ROOT } from '../shared/paths.ts';
import { validateSnapshot } from '../shared/validation.ts';
import { referencedMediaIds } from '../shared/media-references.ts';
import type { Release, Snapshot } from '../shared/types.ts';
const releaseRoot = path.join(DATA_DIR, 'releases');
let queue = Promise.resolve();
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
function atomicJSON(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, file);
}
function validId(id: string) {
  if (!/^[a-z0-9-]{10,80}$/.test(id)) fail('Invalid release identifier', 404);
  return id;
}
function metaPath(id: string) {
  return path.join(releaseRoot, validId(id), 'release.json');
}
function readRelease(id: string): Release {
  try {
    return JSON.parse(fs.readFileSync(metaPath(id), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') fail('Release not found', 404);
    throw error;
  }
}
function saveRelease(release: Release) {
  atomicJSON(metaPath(release.id), release);
}
export function initializePublisher() {
  fs.mkdirSync(releaseRoot, { recursive: true });
  for (const r of listReleases())
    if (r.status === 'building') {
      r.status = 'failed';
      r.error = 'Build interrupted by server restart. Create a new preview to retry.';
      saveRelease(r);
    }
}
export function listReleases(): Release[] {
  if (!fs.existsSync(releaseRoot)) return [];
  return fs
    .readdirSync(releaseRoot)
    .filter((id) => /^[a-z0-9-]{10,80}$/.test(id))
    .flatMap((id) => {
      try {
        return [readRelease(id)];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function releaseDirectory(id: string) {
  return path.join(releaseRoot, validId(id), 'dist');
}
export function getCurrentRelease(): Release | null {
  try {
    const { id } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'current.json'), 'utf8'));
    return readRelease(id);
  } catch {
    return null;
  }
}
function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  logFile: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '',
      timedOut = false;
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    const out = fs.createWriteStream(logFile, { flags: 'a' });
    const append = (b: Buffer) => {
      out.write(b);
      tail = (tail + String(b)).slice(-4000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      forceTimer = setTimeout(() => child.kill('SIGKILL'), 3000);
    }, 180_000);
    const cleanup = () => {
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      out.end();
    };
    child.on('error', (error) => {
      cleanup();
      reject(error);
    });
    child.on('close', (code) => {
      cleanup();
      if (code === 0 && !timedOut) resolve();
      else
        reject(
          new Error(
            timedOut
              ? 'Build exceeded its three minute time limit.'
              : `Build command failed (${code}): ${tail.slice(-1600)}`,
          ),
        );
    });
  });
}
function referencedMedia(snapshot: Snapshot) {
  const ids = referencedMediaIds(snapshot);
  return snapshot.media.filter((media) => ids.has(media.id));
}
async function buildRelease(release: Release, snapshot: Snapshot) {
  const folder = path.dirname(metaPath(release.id));
  try {
    const output = releaseDirectory(release.id);
    const env = {
      ...process.env,
      FOLIO_SNAPSHOT: path.join(folder, 'snapshot.json'),
      FOLIO_OUTPUT: output,
      ASTRO_TELEMETRY_DISABLED: '1',
    };
    await run(
      process.execPath,
      [
        path.join(ROOT, 'node_modules/astro/astro.js'),
        'build',
        '--root',
        path.join(ROOT, 'apps/site'),
      ],
      env,
      path.join(folder, 'build.log'),
    );
    fs.mkdirSync(path.join(output, 'media'), { recursive: true });
    for (const media of referencedMedia(snapshot)) {
      if (path.basename(media.filename) !== media.filename)
        throw new Error('Invalid media filename');
      const source = path.join(folder, 'assets', media.filename);
      if (fs.existsSync(source))
        fs.copyFileSync(source, path.join(output, 'media', media.filename));
      else throw new Error(`Frozen media missing: ${media.filename}`);
    }
    await run(
      process.execPath,
      [path.join(ROOT, 'node_modules/pagefind/lib/runner/bin.cjs'), '--site', output],
      env,
      path.join(folder, 'build.log'),
    );
    for (const locale of ['zh-cn', 'en', 'fr'])
      if (!fs.existsSync(path.join(output, locale, 'index.html')))
        throw new Error(`Missing language homepage: ${locale}`);
    atomicJSON(path.join(output, 'release.json'), {
      id: release.id,
      createdAt: release.createdAt,
      revision: release.revision,
    });
    release.status = 'ready';
    saveRelease(release);
  } catch (error) {
    release.status = 'failed';
    release.error = (error as Error).message;
    saveRelease(release);
  }
}
export async function createRelease(snapshot: Snapshot): Promise<Release> {
  const issues = validateSnapshot(snapshot);
  if (issues.length)
    throw Object.assign(
      new Error('Resolve language and media validation issues before creating a preview'),
      { status: 422, issues },
    );
  const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const host = process.env.PUBLIC_HOST || '127.0.0.1';
  const port = process.env.PREVIEW_PORT || '4322';
  const release: Release = {
    id,
    revision: snapshot.revision,
    status: 'building',
    createdAt: new Date().toISOString(),
    publishedAt: null,
    error: null,
    previewUrl: `http://${host}:${port}/?release=${id}`,
    previewedAt: null,
  };
  const folder = path.dirname(metaPath(id));
  fs.mkdirSync(path.join(folder, 'assets'), { recursive: true });
  try {
    for (const media of referencedMedia(snapshot)) {
      if (path.basename(media.filename) !== media.filename) fail('Invalid media filename');
      const uploaded = path.join(DATA_DIR, 'media', media.filename);
      const bundled = path.join(ROOT, 'apps/site/public/media', media.filename);
      const source = fs.existsSync(uploaded) ? uploaded : bundled;
      if (!fs.existsSync(source)) fail(`Media missing: ${media.filename}`, 422);
      fs.copyFileSync(source, path.join(folder, 'assets', media.filename));
    }
  } catch (error) {
    fs.rmSync(folder, { recursive: true, force: true });
    throw error;
  }
  atomicJSON(path.join(folder, 'snapshot.json'), snapshot);
  saveRelease(release);
  const frozen = structuredClone(snapshot);
  queue = queue
    .then(() => buildRelease(release, frozen))
    .catch((error) => {
      release.status = 'failed';
      release.error = String(error);
      saveRelease(release);
    });
  return structuredClone(release);
}
export function markPreviewed(id: string) {
  const r = readRelease(id);
  if (r.status !== 'ready' && r.status !== 'published') fail('Preview is not ready', 409);
  if (!r.previewedAt) {
    r.previewedAt = new Date().toISOString();
    saveRelease(r);
  }
}
export async function publishRelease(id: string): Promise<Release> {
  const r = readRelease(id);
  if (r.status !== 'ready' && r.status !== 'published') fail('Release is not ready', 409);
  if (!r.previewedAt) fail('Open and inspect the release preview before publishing', 409);
  if (!fs.existsSync(path.join(releaseDirectory(id), 'index.html')))
    fail('Release files are incomplete', 409);
  r.status = 'published';
  r.publishedAt = new Date().toISOString();
  saveRelease(r);
  atomicJSON(path.join(DATA_DIR, 'current.json'), { id });
  return r;
}
export async function rollbackRelease(id: string): Promise<Release> {
  const r = readRelease(id);
  if (!r.publishedAt) fail('Only a previously published version can be restored', 409);
  return publishRelease(id);
}
export async function waitForBuilds() {
  await queue;
}
