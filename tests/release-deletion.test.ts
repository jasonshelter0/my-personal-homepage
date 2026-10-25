import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { Release } from '../shared/types.ts';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-release-deletion-'));
process.env.FOLIO_DATA_DIR = temp;
process.env.ADMIN_PASSWORD = 'release-test-password';
const { deleteRelease, listReleases } = await import('../server/publisher.ts');
const releaseRoot = path.join(temp, 'releases');
const pointer = path.join(temp, 'current.json');
function fixture(id: string, status: Release['status'] = 'ready') {
  const folder = path.join(releaseRoot, id);
  fs.mkdirSync(path.join(folder, 'dist'), { recursive: true });
  const release: Release = {
    id,
    revision: 1,
    status,
    createdAt: '2026-01-01T00:00:00Z',
    publishedAt: status === 'published' ? '2026-01-01T00:01:00Z' : null,
    error: null,
    previewUrl: '/preview/' + id,
    previewedAt: null,
  };
  fs.writeFileSync(path.join(folder, 'release.json'), JSON.stringify(release));
  fs.writeFileSync(path.join(folder, 'snapshot.json'), 'private snapshot');
  fs.writeFileSync(path.join(folder, 'dist', 'index.html'), 'frozen page');
  return folder;
}
const liveId = 'release-live-001';
fixture(liveId, 'published');
fs.writeFileSync(pointer, JSON.stringify({ id: liveId }));
fs.mkdirSync(path.join(temp, 'media'));
fs.writeFileSync(path.join(temp, 'media', 'shared.webp'), 'shared upload');
after(() => fs.rmSync(temp, { recursive: true, force: true }));
const status = (expected: number) => (error: unknown) =>
  (error as { status: number }).status === expected;

test('current and queued/building releases cannot be deleted', () => {
  assert.throws(() => deleteRelease(liveId), status(409));
  for (const id of ['release-building-001', 'release-queued-001']) {
    const folder = fixture(id, 'building');
    assert.throws(() => deleteRelease(id), status(409));
    assert.ok(fs.existsSync(folder));
  }
  assert.equal(JSON.parse(fs.readFileSync(pointer, 'utf8')).id, liveId);
});

test('ready, failed and historical published releases can be removed without shared data loss', () => {
  const shared = fs.readFileSync(path.join(temp, 'media', 'shared.webp'));
  const current = fs.readFileSync(pointer);
  fs.writeFileSync(path.join(temp, 'draft-sentinel.json'), 'draft remains');
  for (const state of ['ready', 'failed', 'published'] as const) {
    const id = `release-delete-${state}`;
    const folder = fixture(id, state);
    deleteRelease(id);
    assert.equal(fs.existsSync(folder), false);
    assert.equal(
      listReleases().some((release) => release.id === id),
      false,
    );
  }
  assert.ok(fs.existsSync(path.join(releaseRoot, liveId, 'snapshot.json')));
  assert.deepEqual(fs.readFileSync(pointer), current);
  assert.deepEqual(fs.readFileSync(path.join(temp, 'media', 'shared.webp')), shared);
  assert.equal(fs.readFileSync(path.join(temp, 'draft-sentinel.json'), 'utf8'), 'draft remains');
});

test('unsafe IDs and nonexistent releases fail without removing anything', () => {
  for (const id of [
    '../media',
    '../../outside',
    '/tmp/external-release',
    'release%2fescape',
    'missing-release-123',
  ])
    assert.throws(() => deleteRelease(id), status(404));
  assert.ok(fs.existsSync(path.join(temp, 'media', 'shared.webp')));
});

test('directory and metadata symlinks are rejected; nested symlink targets are preserved', () => {
  const outside = path.join(temp, 'outside-release');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'do not follow');
  fs.symlinkSync(outside, path.join(releaseRoot, 'release-linked-dir'));
  assert.throws(() => deleteRelease('release-linked-dir'), status(409));
  const linked = fixture('release-linked-meta');
  fs.unlinkSync(path.join(linked, 'release.json'));
  fs.symlinkSync(path.join(releaseRoot, liveId, 'release.json'), path.join(linked, 'release.json'));
  assert.throws(() => deleteRelease('release-linked-meta'), status(409));
  const nested = fixture('release-nested-link');
  fs.symlinkSync(outside, path.join(nested, 'assets'));
  deleteRelease('release-nested-link');
  assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'do not follow');
  assert.ok(fs.existsSync(path.join(releaseRoot, liveId, 'release.json')));
});

test('malformed current pointer blocks deletion rather than treating the site as unpublished', () => {
  fixture('release-pointer-check');
  const current = fs.readFileSync(pointer);
  try {
    for (const content of ['{invalid', '{}', '{"id":null}']) {
      fs.writeFileSync(pointer, content);
      assert.throws(() => deleteRelease('release-pointer-check'), status(409));
      assert.ok(fs.existsSync(path.join(releaseRoot, 'release-pointer-check')));
    }
  } finally {
    fs.writeFileSync(pointer, current);
  }
});

test('release deletion API requires owner authentication and same origin and returns refreshed history', async () => {
  const { createApplications } = await import('../server/index.ts');
  const { admin } = createApplications();
  const server = await new Promise<Server>((resolve) => {
    const listening = admin.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const id = 'release-api-delete';
  fixture(id);
  try {
    assert.equal((await fetch(`${base}/api/releases/${id}`, { method: 'DELETE' })).status, 401);
    const login = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ password: 'release-test-password' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.equal(
      (
        await fetch(`${base}/api/releases/${id}`, {
          method: 'DELETE',
          headers: { Cookie: cookie, Origin: 'https://other.example' },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${base}/api/releases/${liveId}`, {
          method: 'DELETE',
          headers: { Cookie: cookie, Origin: base },
        })
      ).status,
      409,
    );
    const response = await fetch(`${base}/api/releases/${id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie, Origin: base },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.currentId, liveId);
    assert.equal(
      data.releases.some((release: Release) => release.id === id),
      false,
    );
    assert.ok(fs.existsSync(path.join(temp, 'studio.sqlite')));
    assert.ok(fs.existsSync(path.join(temp, 'media', 'shared.webp')));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
