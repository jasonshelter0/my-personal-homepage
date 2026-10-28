import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referencedMediaIds, missingMediaReferences } from '../shared/media-references.ts';
import { seed } from '../shared/seed.ts';
import { contentHash, validateSnapshot } from '../shared/validation.ts';
import { parseSnapshot } from '../server/schema.ts';

test('legacy snapshots receive the default glow radius without changing their revision', () => {
  const legacy = structuredClone(seed);
  Reflect.deleteProperty(legacy.settings, 'cursorGlowRadius');
  const restored = parseSnapshot(legacy);
  assert.equal(restored.settings.cursorGlowRadius, 600);
  assert.equal(restored.revision, legacy.revision);
});

test('glow radius accepts bounded integers and rejects unsafe or invalid values', () => {
  for (const radius of [100, 320, 600, 1200]) {
    const s = structuredClone(seed);
    s.settings.cursorGlowRadius = radius;
    assert.equal(parseSnapshot(s).settings.cursorGlowRadius, radius);
  }
  for (const radius of [0, 99, 1201, -1, 300.5, Infinity, NaN, '600', null]) {
    const s = structuredClone(seed);
    Object.assign(s.settings, { cursorGlowRadius: radius });
    assert.throws(() => parseSnapshot(s));
  }
});
test('legacy media remain valid while optional organization metadata is bounded', () => {
  const legacy = structuredClone(seed);
  for (const media of legacy.media) {
    Reflect.deleteProperty(media, 'collection');
    Reflect.deleteProperty(media, 'tags');
    Reflect.deleteProperty(media, 'uploadedAt');
  }
  assert.equal(parseSnapshot(legacy).media[0].path, legacy.media[0].path);

  const organized = structuredClone(seed);
  organized.media[0].collection = 'Project artwork';
  organized.media[0].tags = ['research', 'homepage'];
  organized.media[0].uploadedAt = '2026-10-28T08:00:00.000Z';
  assert.deepEqual(parseSnapshot(organized).media[0].tags, ['research', 'homepage']);

  const invalid = structuredClone(organized);
  invalid.media[0].tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
  assert.throws(() => parseSnapshot(invalid));
});
test('complete zh-CN/en/fr seed is publishable', () =>
  assert.deepEqual(validateSnapshot(seed), []));
test('source edits invalidate other language versions', () => {
  const s = structuredClone(seed);
  s.entries[0].translations['zh-CN'].body += ' new thought';
  assert.equal(
    validateSnapshot(s).filter((i) => i.message === 'Translation is out of date').length,
    2,
  );
});
test('missing and unreviewed French content prevents publishing', () => {
  const s = structuredClone(seed);
  s.entries[0].translations.fr.body = '';
  s.entries[0].translations.fr.reviewed = false;
  assert.ok(validateSnapshot(s).some((i) => i.path.endsWith('.fr.body')));
  assert.ok(validateSnapshot(s).some((i) => i.message === 'Translation needs review'));
});
test('unpublished draft does not prevent releasing existing complete pages', () => {
  const s = structuredClone(seed);
  s.entries[0].status = 'draft';
  s.entries[0].translations.fr.body = '';
  assert.deepEqual(validateSnapshot(s), []);
});
test('referenced image requires localized alternative text', () => {
  const s = structuredClone(seed);
  s.media[0].alt.fr = '';
  assert.ok(validateSnapshot(s).some((i) => i.path === 'media.atlas.fr'));
});
test('hash ignores review metadata but detects actual text change', () => {
  const t = structuredClone(seed.entries[0].translations.en),
    before = contentHash(t);
  t.reviewed = false;
  t.sourceHash = 'other';
  assert.equal(contentHash(t), before);
  t.title += '!';
  assert.notEqual(contentHash(t), before);
});

test('inline media paths recognize encoded filenames, Markdown, HTML and plain text', () => {
  const s = structuredClone(seed);
  for (const e of s.entries) e.coverId = null;
  s.entries[0].translations.en.body =
    '![Atlas](/media/atlas%2Esvg?v=1#preview)\n<img src="/media/constellation.svg">\nSee /media/field-notes.svg.';
  assert.deepEqual([...referencedMediaIds(s)].sort(), ['atlas', 'constellation', 'field-notes']);
  assert.deepEqual(missingMediaReferences(s), []);
});
test('remote media URLs and code examples are not counted as local assets', () => {
  const s = structuredClone(seed);
  for (const e of s.entries) e.coverId = null;
  s.entries[0].translations.en.body =
    '![remote](https://other.example/media/missing.webp) ![remote](//other.example/media/absent.webp) https://other.example/?image=/media/missing.webp \n`/media/example.webp`\n```md\n![example](/media/demo.webp)\n```';
  assert.deepEqual([...referencedMediaIds(s)], []);
  assert.deepEqual(missingMediaReferences(s), []);
  s.entries[0].translations.en.body =
    '![remote](https://other.example/media/missing.webp)![local](/media/atlas.svg)';
  assert.deepEqual([...referencedMediaIds(s)], ['atlas']);
});
test('profile inline images require all localized media alternatives', () => {
  const s = structuredClone(seed);
  for (const e of s.entries) e.coverId = null;
  s.settings.profile.en.about += '\n![diagram](/media/atlas.svg)';
  s.media[0].alt.fr = '';
  assert.ok(referencedMediaIds(s).has('atlas'));
  assert.ok(validateSnapshot(s).some((i) => i.path === 'media.atlas.fr'));
});
test('missing inline images and missing avatar IDs prevent publication', () => {
  const s = structuredClone(seed);
  s.settings.avatarId = 'lost-avatar';
  s.entries[0].translations.fr.body += '\n![lost](/media/lost%2Ewebp)';
  assert.deepEqual(missingMediaReferences(s), ['id:lost-avatar', '/media/lost.webp']);
  assert.equal(
    validateSnapshot(s).filter((i) => i.message === 'Referenced image is missing').length,
    2,
  );
});
test('draft inline references are excluded from publishing but included for deletion checks', () => {
  const s = structuredClone(seed);
  for (const e of s.entries) e.coverId = null;
  s.entries[0].status = 'draft';
  s.entries[0].translations.en.body = '![image](/media/atlas.svg) ![missing](/media/not-yet.webp)';
  assert.equal(referencedMediaIds(s).has('atlas'), false);
  assert.equal(referencedMediaIds(s, false).has('atlas'), true);
  assert.deepEqual(missingMediaReferences(s), []);
});
test('encoded path separators decode once and malformed escapes fail validation safely', () => {
  const s = structuredClone(seed);
  for (const e of s.entries) e.coverId = null;
  s.entries[0].translations.en.body =
    '![image](/media%2Fatlas%2Esvg) ![double](/media/atlas%252Esvg) ![bad](/media/%ZZ.webp)';
  assert.equal(referencedMediaIds(s).has('atlas'), true);
  assert.deepEqual(missingMediaReferences(s), ['/media/atlas%2Esvg', '/media/%ZZ.webp']);
});
