import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-publisher-test-'));
process.env.FOLIO_DATA_DIR = temp;
const { seed } = await import('../shared/seed.ts');
const { contentHash } = await import('../shared/validation.ts');
const publisher = await import('../server/publisher.ts');
after(() => fs.rmSync(temp, { recursive: true, force: true }));
test(
  'real static releases isolate drafts, require preview, publish frozen artifacts and roll back',
  { timeout: 180000 },
  async () => {
    const snapshot = structuredClone(seed);
    // Old release snapshots have no radius field and must keep their appearance.
    Reflect.deleteProperty(snapshot.settings, 'cursorGlowRadius');
    const draft = structuredClone(snapshot.entries[0]);
    draft.id = 'secret-draft';
    draft.slug = 'never-published';
    draft.status = 'draft';
    for (const t of Object.values(draft.translations)) {
      t.title = 'DO-NOT-PUBLISH-SECRET';
      t.body = 'Private unpublished content';
    }
    snapshot.entries.push(draft);
    fs.mkdirSync(path.join(temp, 'media'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'media', 'private-unused.txt'), 'PRIVATE-ASSET');
    const sharp = (await import('sharp')).default;
    const asset = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#5eead4' },
    })
      .webp()
      .toBuffer();
    fs.writeFileSync(path.join(temp, 'media', 'frozen.webp'), asset);
    snapshot.media.push({
      id: 'frozen',
      filename: 'frozen.webp',
      path: '/media/frozen.webp',
      width: 32,
      height: 32,
      alt: { 'zh-CN': '测试图片', en: 'Test image', fr: 'Image test' },
      caption: { 'zh-CN': '', en: '', fr: '' },
    });
    snapshot.entries[0].coverId = 'frozen';
    publisher.initializePublisher();
    const r1 = await publisher.createRelease(snapshot);
    fs.unlinkSync(path.join(temp, 'media', 'frozen.webp'));
    assert.equal(r1.status, 'building');
    await assert.rejects(publisher.publishRelease(r1.id));
    snapshot.settings.profile.en.name = 'MUTATED AFTER BUILD REQUEST';
    await publisher.waitForBuilds();
    let ready = publisher.listReleases().find((r) => r.id === r1.id)!;
    assert.equal(ready.status, 'ready', ready.error || 'build should complete');
    const out = publisher.releaseDirectory(r1.id);
    const html = fs.readFileSync(path.join(out, 'en/index.html'), 'utf8');
    assert.deepEqual(fs.readFileSync(path.join(out, 'media', 'frozen.webp')), asset);
    assert.ok(html.includes('Jason'));
    assert.ok(html.includes('--glow-radius:600px'));
    assert.ok(!html.includes('MUTATED AFTER BUILD REQUEST'));
    assert.ok(!html.includes('DO-NOT-PUBLISH-SECRET'));
    assert.ok(!fs.existsSync(path.join(out, 'en/projects/never-published/index.html')));
    assert.ok(!fs.existsSync(path.join(out, 'media/private-unused.txt')));
    assert.ok(!fs.existsSync(path.join(out, 'snapshot.json')));
    assert.ok(fs.existsSync(path.join(out, 'pagefind/pagefind.js')));
    await assert.rejects(publisher.publishRelease(r1.id), /preview/i);
    publisher.markPreviewed(r1.id);
    await publisher.publishRelease(r1.id);
    assert.equal(publisher.getCurrentRelease()!.id, r1.id);
    const second = structuredClone(seed);
    second.revision = 2;
    second.settings.cursorGlowRadius = 320;
    for (const p of Object.values(second.settings.profile)) p.name = 'Version Two';
    for (const p of Object.values(second.settings.profile))
      p.sourceHash = contentHash(second.settings.profile['zh-CN']);
    const r2 = await publisher.createRelease(second);
    second.settings.cursorGlowRadius = 1200;
    await publisher.waitForBuilds();
    ready = publisher.listReleases().find((r) => r.id === r2.id)!;
    assert.equal(ready.status, 'ready', ready.error || 'second build');
    publisher.markPreviewed(r2.id);
    await publisher.publishRelease(r2.id);
    assert.equal(publisher.getCurrentRelease()!.id, r2.id);
    for (const locale of ['zh-cn', 'en', 'fr'])
      assert.ok(
        fs
          .readFileSync(
            path.join(publisher.releaseDirectory(r2.id), `${locale}/index.html`),
            'utf8',
          )
          .includes('--glow-radius:320px'),
      );
    assert.ok(
      fs
        .readFileSync(path.join(publisher.releaseDirectory(r2.id), 'en/index.html'), 'utf8')
        .includes('Version Two'),
    );
    await publisher.rollbackRelease(r1.id);
    assert.equal(publisher.getCurrentRelease()!.id, r1.id);
    assert.ok(
      fs
        .readFileSync(path.join(publisher.releaseDirectory(r1.id), 'en/index.html'), 'utf8')
        .includes('--glow-radius:600px'),
    );
    assert.ok(
      fs
        .readFileSync(path.join(publisher.releaseDirectory(r1.id), 'en/index.html'), 'utf8')
        .includes('Jason'),
    );
    const invalid = structuredClone(seed);
    invalid.entries[0].translations.fr.body = '';
    await assert.rejects(publisher.createRelease(invalid), /language/i);
    assert.throws(() => publisher.releaseDirectory('../../etc'), /Invalid/);
    const interrupted = { ...r1, id: 'interrupted-build-001', status: 'building' };
    fs.mkdirSync(path.join(temp, 'releases', interrupted.id));
    fs.writeFileSync(
      path.join(temp, 'releases', interrupted.id, 'release.json'),
      JSON.stringify(interrupted),
    );
    publisher.initializePublisher();
    assert.equal(publisher.listReleases().find((r) => r.id === interrupted.id)!.status, 'failed');
  },
);
