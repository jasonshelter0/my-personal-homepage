import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../shared/seed.ts';
import type { HomeSection, Snapshot } from '../shared/types.ts';
import { parseSnapshot } from '../server/schema.ts';
import { validateSnapshot } from '../shared/validation.ts';
import { isBuiltinSection, sectionTitle } from '../shared/sections.ts';
import { referencedMediaIds, missingMediaReferences } from '../shared/media-references.ts';

const text = (value: string) => ({ 'zh-CN': value, en: value, fr: value });
const section = (overrides: Partial<HomeSection> = {}): HomeSection => ({
  id: 'section-research',
  enabled: true,
  titles: { 'zh-CN': '研究', en: 'Research', fr: 'Recherche' },
  body: text('Research notes.'),
  ...overrides,
});
function withSection(value = section()): Snapshot {
  const s = structuredClone(seed);
  s.settings.sections.push(value);
  return s;
}
const sectionIssues = (s: Snapshot) =>
  validateSnapshot(s).filter((issue) => issue.path.startsWith('sections.'));

test('legacy four-section snapshots remain identical without migration', () => {
  assert.deepEqual(parseSnapshot(seed), seed);
  assert.equal(sectionTitle(seed.settings.sections[0], 'zh-CN'), '关于');
  assert.equal(sectionTitle(seed.settings.sections[0], 'en'), 'About');
  assert.equal(sectionTitle(seed.settings.sections[0], 'fr'), 'À propos');
  assert.equal(isBuiltinSection('about'), true);
  assert.equal(isBuiltinSection('section-about'), false);
});

test('sections can be added, reordered, removed and all omitted', () => {
  const s = withSection();
  const custom = s.settings.sections.pop()!;
  s.settings.sections.unshift(custom);
  assert.deepEqual(parseSnapshot(s).settings.sections[0], custom);
  assert.deepEqual(sectionIssues(s), []);
  s.settings.sections = [];
  assert.deepEqual(parseSnapshot(s).settings.sections, []);
  assert.deepEqual(sectionIssues(s), []);
});

test('localized overrides preserve defaults in drafts and require complete publishing titles', () => {
  const s = structuredClone(seed);
  s.settings.sections[0].titles = { 'zh-CN': '我的故事', en: '', fr: '' };
  assert.equal(sectionTitle(s.settings.sections[0], 'zh-CN'), '我的故事');
  assert.equal(sectionTitle(s.settings.sections[0], 'en'), 'About');
  assert.deepEqual(
    sectionIssues(s).map((i) => i.path),
    ['sections.about.titles.en', 'sections.about.titles.fr'],
  );
  s.settings.sections[0].titles = text('');
  assert.deepEqual(sectionIssues(s), []);
  assert.equal(sectionTitle(section({ titles: text('') }), 'en'), 'Untitled section');
});

test('custom anchors cannot collide with page anchors or inject HTML and must be unique', () => {
  for (const id of [
    'main',
    'search-dialog',
    'heading-about',
    'section-',
    'section-Research',
    'section-<img>',
    'section-x\" onclick=alert(1)',
    'section-a/b',
    'section-' + 'a'.repeat(94),
  ]) {
    assert.throws(() => parseSnapshot(withSection(section({ id }))));
  }
  assert.doesNotThrow(() =>
    parseSnapshot(withSection(section({ id: 'section-5096c2b6-6347-40a9-9fbe-98242424cac4' }))),
  );
  const s = withSection();
  s.settings.sections.push(section());
  assert.throws(() => parseSnapshot(s));
});

test('section counts, title length, entry count and entry uniqueness are bounded', () => {
  const s = structuredClone(seed);
  s.settings.sections = Array.from({ length: 30 }, (_, i) => section({ id: `section-${i}` }));
  assert.doesNotThrow(() => parseSnapshot(s));
  s.settings.sections.push(section({ id: 'section-31' }));
  assert.throws(() => parseSnapshot(s));
  assert.throws(() => parseSnapshot(withSection(section({ titles: text('x'.repeat(121)) }))));
  assert.throws(() => parseSnapshot(withSection(section({ entryIds: ['same', 'same'] }))));
  assert.throws(() =>
    parseSnapshot(
      withSection(section({ entryIds: Array.from({ length: 101 }, (_, i) => `entry-${i}`) })),
    ),
  );
});

test('built-in sections retain their own content source instead of silently ignoring custom data', () => {
  const s = structuredClone(seed);
  s.settings.sections[0].body = text('Unexpected separate content');
  assert.throws(() => parseSnapshot(s));
  delete s.settings.sections[0].body;
  s.settings.sections[0].entryIds = [s.entries[0].id];
  assert.throws(() => parseSnapshot(s));
});

test('enabled custom titles and any authored body require all three languages', () => {
  const s = withSection(
    section({
      titles: { 'zh-CN': '研究', en: '', fr: '' },
      body: { 'zh-CN': '正文', en: '', fr: '' },
    }),
  );
  assert.doesNotThrow(() => parseSnapshot(s)); // Incomplete drafts remain saveable.
  assert.deepEqual(
    sectionIssues(s).map((i) => i.path),
    [
      'sections.section-research.titles.en',
      'sections.section-research.titles.fr',
      'sections.section-research.body.en',
      'sections.section-research.body.fr',
    ],
  );
  s.settings.sections.at(-1)!.enabled = false;
  assert.deepEqual(sectionIssues(s), []);
});

test('custom cards preserve chosen order and may coexist with Markdown', () => {
  const s = withSection(section({ entryIds: [seed.entries[1].id, seed.entries[0].id] }));
  assert.deepEqual(parseSnapshot(s).settings.sections.at(-1)!.entryIds, [
    seed.entries[1].id,
    seed.entries[0].id,
  ]);
  assert.deepEqual(sectionIssues(s), []);
  delete s.settings.sections.at(-1)!.body;
  assert.deepEqual(sectionIssues(s), []);
});

test('empty and draft-only custom sections cannot be published, but drafts can be selected', () => {
  const s = withSection(section({ body: undefined }));
  assert.match(sectionIssues(s)[0].message, /at least one published entry/);
  const custom = s.settings.sections.at(-1)!;
  custom.entryIds = [s.entries[0].id];
  s.entries[0].status = 'draft';
  assert.match(sectionIssues(s)[0].message, /at least one published entry/);
  custom.body = text('Intro');
  assert.deepEqual(sectionIssues(s), []);
  delete custom.body;
  custom.entryIds.push(s.entries[1].id);
  assert.deepEqual(sectionIssues(s), []);
});

test('missing selected entries fail publication without blocking hidden unfinished sections', () => {
  const s = withSection(section({ entryIds: ['deleted-entry'] }));
  assert.deepEqual(sectionIssues(s), [
    {
      path: 'sections.section-research.entryIds.deleted-entry',
      message: 'Selected section entry is missing',
    },
  ]);
  s.settings.sections.at(-1)!.enabled = false;
  assert.deepEqual(sectionIssues(s), []);
});

test('custom inline media are frozen and validated, including localized alternatives', () => {
  const s = withSection(section({ body: text('![Diagram](/media/atlas.svg)') }));
  for (const e of s.entries) e.coverId = null;
  assert.deepEqual([...referencedMediaIds(s)], ['atlas']);
  s.media.find((m) => m.id === 'atlas')!.alt.fr = '';
  assert.ok(validateSnapshot(s).some((issue) => issue.path === 'media.atlas.fr'));
  s.settings.sections.at(-1)!.body!.en += '\n![Missing](/media/missing.webp)';
  assert.deepEqual(missingMediaReferences(s), ['/media/missing.webp']);
});

test('hidden sections exclude inline media from releases but still protect editor uploads', () => {
  const s = withSection(
    section({
      enabled: false,
      body: text('![Diagram](/media/atlas.svg) ![Missing](/media/absent.webp)'),
    }),
  );
  for (const e of s.entries) e.coverId = null;
  s.media.find((m) => m.id === 'atlas')!.alt.fr = '';
  assert.deepEqual([...referencedMediaIds(s)], []);
  assert.deepEqual(missingMediaReferences(s), []);
  assert.deepEqual(validateSnapshot(s), []);
  assert.deepEqual([...referencedMediaIds(s, false)], ['atlas']);
});
