import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest, type Server } from 'node:http';
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import type { Snapshot } from '../shared/types.ts';
const dir = await mkdtemp(join(tmpdir(), 'folio-api-test-'));
process.env.FOLIO_DATA_DIR = dir;
process.env.ADMIN_PASSWORD = 'test-owner-password';
delete process.env.TRANSLATION_BASE_URL;
delete process.env.TRANSLATION_API_KEY;
delete process.env.TRANSLATION_MODEL;
const { createApplications } = await import('../server/index.ts');
const { admin, preview, production } = createApplications();
let servers: Server[] = [],
  base = '',
  previewBase = '',
  productionBase = '',
  cookie = '';
before(async () => {
  for (const app of [admin, preview, production]) {
    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    servers.push(server);
  }
  const urls = servers.map((s) => `http://127.0.0.1:${(s.address() as { port: number }).port}`);
  [base, previewBase, productionBase] = urls;
});
after(async () => {
  await Promise.all(
    servers.map(
      (s) => new Promise<void>((resolve, reject) => s.close((e) => (e ? reject(e) : resolve()))),
    ),
  );
  await rm(dir, { recursive: true, force: true });
});
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  extra: Record<string, string> = {},
) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== 'GET' ? { 'Content-Type': 'application/json', Origin: base } : {}),
      ...extra,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function snapshot() {
  const res = await request('/api/snapshot');
  assert.equal(res.status, 200);
  return (await res.json()) as Snapshot;
}
test('owner-only API, login, CSRF and local host protections', async () => {
  assert.equal((await request('/api/snapshot')).status, 401);
  assert.equal((await fetch(`${previewBase}/`)).status, 401);
  assert.equal((await request('/api/login', 'POST', { password: 'incorrect' })).status, 401);
  const login = await request('/api/login', 'POST', { password: 'test-owner-password' });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  assert.match(login.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(login.headers.get('set-cookie')!, /SameSite=Strict/);
  assert.equal((await request('/api/session')).status, 200);
  assert.equal(
    (await request('/api/logout', 'POST', {}, { Origin: 'https://malicious.example' })).status,
    403,
  );
  const badHost = await new Promise<number | undefined>((resolve, reject) => {
    const r = httpRequest(
      `${base}/api/snapshot`,
      { headers: { Host: 'malicious.example', Cookie: cookie } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    r.on('error', reject);
    r.end();
  });
  assert.equal(badHost, 403);
});
test('persistent draft revisions, schema validation and explicit translation reviews', async () => {
  const draft = await snapshot(),
    old = structuredClone(draft),
    entry = draft.entries[0];
  entry.translations.en.title = 'An edited title';
  entry.translations.en.reviewed = true;
  entry.translations.en.sourceHash = 'forged';
  const save = await request('/api/snapshot', 'PUT', draft);
  assert.equal(save.status, 200);
  const saved = (await save.json()) as Snapshot;
  assert.equal(saved.revision, old.revision + 1);
  assert.equal(saved.entries[0].translations.en.reviewed, false);
  assert.notEqual(saved.entries[0].translations.en.sourceHash, 'forged');
  assert.equal((await request('/api/snapshot', 'PUT', old)).status, 409);
  const reviewed = await request('/api/review', 'POST', { entryId: entry.id, locale: 'en' });
  assert.equal(reviewed.status, 200);
  assert.equal(((await reviewed.json()) as Snapshot).entries[0].translations.en.reviewed, true);
  const bad = await snapshot();
  bad.settings.socials[0].url = 'javascript:alert(1)';
  assert.equal((await request('/api/snapshot', 'PUT', bad)).status, 400);
  const traversal = await snapshot();
  traversal.entries[0].slug = '../evil';
  assert.equal((await request('/api/snapshot', 'PUT', traversal)).status, 400);
  const media = await snapshot();
  media.media.push({
    id: 'fake',
    filename: 'fake.webp',
    path: '/media/fake.webp',
    width: 1,
    height: 1,
    alt: { 'zh-CN': '', en: '', fr: '' },
    caption: { 'zh-CN': '', en: '', fr: '' },
  });
  assert.equal((await request('/api/snapshot', 'PUT', media)).status, 400);
});
test('translation is honestly unavailable without provider and previews remain private', async () => {
  const status = await request('/api/translation/status');
  assert.equal((await status.json()).configured, false);
  assert.equal(
    (await request('/api/translate', 'POST', { profile: true, targetLocale: 'fr' })).status,
    503,
  );
  assert.equal(
    (await fetch(`${previewBase}/?release=../../`, { headers: { Cookie: cookie } })).status,
    404,
  );
  const response = await fetch(`${productionBase}/api/snapshot`);
  assert.notEqual(response.status, 200);
  const validation = await request('/api/validation');
  assert.ok(Array.isArray((await validation.json()).issues));
});
test('raster uploads, source-file sanitization, metadata editing and reference-safe deletion', async () => {
  const svg = new FormData();
  svg.append(
    'image',
    new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], {
      type: 'image/svg+xml',
    }),
    'danger.svg',
  );
  assert.equal(
    (
      await fetch(`${base}/api/media`, {
        method: 'POST',
        headers: { Cookie: cookie, Origin: base },
        body: svg,
      })
    ).status,
    400,
  );
  const png = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#75d4b8' } })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'test.png');
  const upload = await fetch(`${base}/api/media`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: base },
    body: form,
  });
  assert.equal(upload.status, 201);
  const { snapshot: draft, media } = await upload.json();
  assert.equal(media.width, 16);
  assert.match(media.filename, /\.webp$/);
  assert.equal((await fetch(`${base}${media.path}`)).status, 401);
  assert.equal((await fetch(`${base}${media.path}`, { headers: { Cookie: cookie } })).status, 200);
  draft.entries[0].translations.en.body += `\n![test](${media.path})`;
  assert.equal((await request('/api/snapshot', 'PUT', draft)).status, 200);
  assert.equal((await request(`/api/media/${media.id}`, 'DELETE')).status, 409);
  const encoded = await snapshot();
  encoded.entries[0].translations.en.body = encoded.entries[0].translations.en.body.replace(
    media.path,
    media.path.replace('.webp', '%2Ewebp'),
  );
  encoded.entries[0].status = 'draft';
  assert.equal((await request('/api/snapshot', 'PUT', encoded)).status, 200);
  assert.equal((await request(`/api/media/${media.id}`, 'DELETE')).status, 409);
  const unlinked = await snapshot();
  unlinked.entries[0].translations.en.body = unlinked.entries[0].translations.en.body.replace(
    `\n![test](${media.path.replace('.webp', '%2Ewebp')})`,
    '',
  );
  assert.equal((await request('/api/snapshot', 'PUT', unlinked)).status, 200);
  assert.equal((await request(`/api/media/${media.id}`, 'DELETE')).status, 200);
});
test('provider translation preserves links, requires overwrite and catches concurrent edits', async () => {
  const express = (await import('express')).default;
  const provider = express();
  provider.use(express.json());
  let wrongLink = false,
    modifyDuringRequest = false,
    oversized = false;
  provider.post('/v1/chat/completions', async (req, res) => {
    const data = JSON.parse(req.body.messages[1].content);
    for (const key of Object.keys(data)) data[key] = `Traduit : ${data[key]}`;
    if (oversized) data.title = 'x'.repeat(501);
    if (wrongLink) data.body = (data.body || '') + ' [bad](https://different.example)';
    if (modifyDuringRequest) {
      const draft = await snapshot();
      draft.settings.accent = '#abc123';
      await request('/api/snapshot', 'PUT', draft);
    }
    res.json({ choices: [{ message: { content: JSON.stringify(data) } }] });
  });
  const server = await new Promise<Server>((resolve) => {
    const s = provider.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    process.env.TRANSLATION_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
    process.env.TRANSLATION_API_KEY = 'test-key';
    process.env.TRANSLATION_MODEL = 'test-model';
    const draft = await snapshot();
    const entry = draft.entries[0];
    const target = entry.sourceLocale === 'fr' ? 'en' : 'fr';
    assert.equal(
      (await request('/api/review', 'POST', { entryId: entry.id, locale: target })).status,
      200,
    );
    assert.equal(
      (await request('/api/translate', 'POST', { entryId: entry.id, targetLocale: target })).status,
      409,
    );
    const translated = await request('/api/translate', 'POST', {
      entryId: entry.id,
      targetLocale: target,
      overwrite: true,
    });
    assert.equal(translated.status, 200);
    const saved = (await translated.json()) as Snapshot;
    assert.equal(saved.entries[0].translations[target].reviewed, false);
    assert.match(saved.entries[0].translations[target].title, /^Traduit/);
    oversized = true;
    assert.equal(
      (
        await request('/api/translate', 'POST', {
          entryId: entry.id,
          targetLocale: target,
          overwrite: true,
        })
      ).status,
      502,
    );
    oversized = false;
    wrongLink = true;
    assert.equal(
      (
        await request('/api/translate', 'POST', {
          entryId: entry.id,
          targetLocale: target,
          overwrite: true,
        })
      ).status,
      502,
    );
    wrongLink = false;
    modifyDuringRequest = true;
    assert.equal(
      (
        await request('/api/translate', 'POST', {
          entryId: entry.id,
          targetLocale: target,
          overwrite: true,
        })
      ).status,
      409,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.TRANSLATION_BASE_URL;
    delete process.env.TRANSLATION_API_KEY;
    delete process.env.TRANSLATION_MODEL;
  }
});
test('draft survives a fresh process reading the durable SQLite store', async () => {
  const current = await snapshot();
  const child = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      "import {getSnapshot} from './server/store.ts'; process.stdout.write(JSON.stringify(getSnapshot()));",
    ],
    { env: process.env, encoding: 'utf8' },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), current);
});
test('logout revokes the persisted server session', async () => {
  assert.equal((await request('/api/logout', 'POST', {})).status, 200);
  assert.equal((await request('/api/snapshot')).status, 401);
});
