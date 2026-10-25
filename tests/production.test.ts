import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-production-test-'));
process.env.FOLIO_DATA_DIR = dataDir;
process.env.SERVE_PUBLIC = 'true';
process.env.PREVIEW_BASE_PATH = '/preview';
process.env.PUBLIC_ORIGIN = 'https://www.jasonshelter.com';
process.env.COOKIE_SECURE = 'true';
process.env.ADMIN_PASSWORD = 'test-production-owner-password';
process.env.NODE_ENV = 'production';
process.env.HOST = '127.0.0.1';
const { createApplications } = await import('../server/index.ts');
const { validateRuntimeConfig } = await import('../server/config.ts');
const { seed } = await import('../shared/seed.ts');
const publisher = await import('../server/publisher.ts');
let server: Server | undefined;
after(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => server!.close((e) => (e ? reject(e) : resolve())));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('production configuration rejects demo credentials and insecure origins', () => {
  validateRuntimeConfig();
  const saved = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'local-demo-password';
  assert.throws(validateRuntimeConfig, /ADMIN_PASSWORD/);
  process.env.ADMIN_PASSWORD = saved;
  process.env.PUBLIC_ORIGIN = 'http://www.jasonshelter.com';
  assert.throws(validateRuntimeConfig, /HTTPS/);
  process.env.PUBLIC_ORIGIN = 'https://www.jasonshelter.com';
  process.env.COOKIE_SECURE = 'false';
  assert.throws(validateRuntimeConfig, /COOKIE_SECURE/);
  process.env.COOKIE_SECURE = 'true';
  process.env.PREVIEW_BASE_PATH = '/admin';
  assert.throws(validateRuntimeConfig, /PREVIEW_BASE_PATH/);
  process.env.PREVIEW_BASE_PATH = '/preview';
});

test(
  'same-origin gateway keeps drafts private, previews prefixed and public pages independently published',
  { timeout: 180000 },
  async () => {
    const apps = createApplications();
    server = await new Promise<Server>((resolve) => {
      const s = apps.admin.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    let cookie = '';
    const request = (route: string, method = 'GET', body?: unknown, authenticated = false) =>
      fetch(base + route, {
        method,
        redirect: 'manual',
        headers: {
          Host: 'www.jasonshelter.com',
          'X-Forwarded-Proto': 'https',
          ...(authenticated ? { Cookie: cookie } : {}),
          ...(method !== 'GET'
            ? { 'Content-Type': 'application/json', Origin: 'https://www.jasonshelter.com' }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const healthBefore = await request('/healthz');
    assert.equal(healthBefore.status, 503);
    assert.deepEqual(await healthBefore.json(), {
      status: 'not_ready',
      checks: { database: true, editor: true, website: false },
    });
    assert.equal((await request('/admin/')).status, 200);
    assert.equal((await request('/api/snapshot')).status, 401);
    assert.equal((await request('/admin/media/atlas.svg')).status, 401);
    assert.equal((await request('/preview/unknown-release/')).status, 401);
    const login = await request('/api/login', 'POST', { password: process.env.ADMIN_PASSWORD });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie')!;
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    cookie = setCookie.split(';')[0];
    assert.equal((await login.json()).productionUrl, 'https://www.jasonshelter.com');
    const privateMedia = await request('/admin/media/atlas.svg', 'GET', undefined, true);
    assert.equal(privateMedia.status, 200);
    assert.equal(privateMedia.headers.get('cache-control'), 'no-store');

    const release = await publisher.createRelease(structuredClone(seed));
    await publisher.waitForBuilds();
    const ready = publisher.listReleases().find((r) => r.id === release.id)!;
    assert.equal(ready.status, 'ready', ready.error || 'release must build');
    assert.equal(ready.previewUrl, `https://www.jasonshelter.com/preview/${release.id}/`);
    assert.equal((await request(`/preview/${release.id}/en/`)).status, 401);
    assert.equal(
      (await request(`/api/releases/${release.id}/publish`, 'POST', {}, true)).status,
      409,
    );
    const preview = await request(`/preview/${release.id}/en/`, 'GET', undefined, true);
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get('cache-control'), 'no-store');
    assert.match(preview.headers.get('x-robots-tag')!, /noindex/);
    const html = await preview.text();
    assert.ok(
      html.includes(`/preview/${release.id}/_astro/`),
      'preview assets must retain private prefix',
    );
    assert.ok(
      html.includes(`/preview/${release.id}/fr/`),
      'language links must retain private prefix',
    );
    for (const locale of ['zh-cn', 'en', 'fr']) {
      const course = `/preview/${release.id}/${locale}/learn/mamba-tta-irstd/tent/`;
      assert.equal((await request(course)).status, 401);
      const lesson = await request(course, 'GET', undefined, true);
      assert.equal(lesson.status, 200);
      const content = await lesson.text();
      assert.ok(content.includes(`href="/preview/${release.id}/${locale}/learn/mamba-tta-irstd/`));
      assert.match(content, /data-demo="entropy"/);
      assert.ok(content.includes(`rel="canonical" href="${seed.settings.siteUrl}/${locale}/learn/mamba-tta-irstd/tent/"`));
      assert.ok(!content.match(/rel="canonical" href="[^"]*\/preview\//));
    }
    const asset = html.match(/src="([^"]+\/_astro\/[^\"]+\.js)"/)?.[1];
    assert.ok(asset, 'preview contains a module asset');
    assert.equal((await request(asset!, 'GET', undefined, true)).status, 200);
    assert.equal((await request(asset!)).status, 401);
    assert.equal(
      (await request(`/preview/${release.id}/pagefind/pagefind.js`, 'GET', undefined, true)).status,
      200,
    );
    assert.equal(
      (await request(`/preview/${release.id}/media/atlas.svg`, 'GET', undefined, true)).status,
      200,
    );
    assert.equal((await request('/en/')).status, 503);
    assert.equal(
      (await request(`/api/releases/${release.id}/publish`, 'POST', {}, true)).status,
      200,
    );
    assert.equal((await request('/en/')).status, 200);
    assert.equal((await request('/media/atlas.svg')).status, 200);
    const health = await request('/healthz');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      status: 'ok',
      checks: { database: true, editor: true, website: true },
    });
    assert.equal(
      (await fetch(`${base}/healthz`)).status,
      200,
      'loopback Docker health check works without a public Host header',
    );
    const publicHTML = await (await request('/en/')).text();
    assert.ok(!publicHTML.includes(`/preview/${release.id}/`));
    assert.equal((await request('/.folio/studio.sqlite')).status, 404);
    assert.equal((await request('/snapshot.json')).status, 404);
    for (const locale of ['zh-cn', 'en', 'fr']) {
      assert.equal((await request(`/${locale}/learn/mamba-tta-irstd/`)).status, 200);
      assert.equal((await request(`/${locale}/learn/mamba-tta-irstd/lab/`)).status, 200);
    }
    assert.equal((await request('/learn/mamba-tta-irstd/')).status, 200);
    assert.equal((await request('/en/learn/mamba-tta-irstd/not-a-chapter/')).status, 404);
    const sitemap = await (await request('/sitemap.xml')).text();
    assert.match(sitemap, /\/fr\/learn\/mamba-tta-irstd\/tent\//);
    assert.doesNotMatch(sitemap, /\/preview\//);
  },
);
