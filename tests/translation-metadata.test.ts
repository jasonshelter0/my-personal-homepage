import { test, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HomeSection, Snapshot } from '../shared/types.ts';
import { seed } from '../shared/seed.ts';
import { contentHash } from '../shared/validation.ts';

const dir = await mkdtemp(join(tmpdir(), 'folio-metadata-translation-'));
process.env.FOLIO_DATA_DIR = dir;
const { translate, review } = await import('../server/translation.ts');
const { getSnapshot, saveSnapshot } = await import('../server/store.ts');
const realFetch = globalThis.fetch;
let calls: Array<{ source: Record<string, string>; system: string }> = [];
const section: HomeSection = {
  id: 'section-notes',
  enabled: true,
  titles: { 'zh-CN': '笔记', en: 'Notes', fr: '' },
  body: {
    'zh-CN': '学习笔记',
    en: 'Read [this](https://example.com/notes) and use `code`.',
    fr: '',
  },
};
beforeEach(() => {
  process.env.TRANSLATION_BASE_URL = 'https://ai.example/v1';
  process.env.TRANSLATION_API_KEY = 'synthetic-test-key';
  process.env.TRANSLATION_MODEL = 'synthetic-model';
  delete process.env.LIBRETRANSLATE_URL;
  const snapshot = structuredClone(seed);
  snapshot.revision = getSnapshot().revision;
  snapshot.settings.sections.push(structuredClone(section));
  saveSnapshot(snapshot);
  calls = [];
  mockAI();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});
function mockAI(
  transform: (source: Record<string, string>) => unknown = (source) =>
    Object.fromEntries(Object.entries(source).map(([key, value]) => [key, `FR ${value}`])),
) {
  globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), 'https://ai.example/v1/chat/completions');
    const request = JSON.parse(String(init?.body));
    const source = JSON.parse(request.messages[1].content);
    calls.push({ source, system: request.messages[0].content });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(transform(source)) } }] }),
    );
  }) as typeof fetch;
}
const mediaRequest = (extra = {}) => ({
  mediaId: seed.media[0].id,
  sourceLocale: 'en',
  targetLocale: 'fr',
  overwrite: true,
  provider: 'openai',
  ...extra,
});
const sectionRequest = (extra = {}) => ({
  sectionId: section.id,
  sourceLocale: 'en',
  targetLocale: 'fr',
  provider: 'openai',
  ...extra,
});
function edit(change: (s: Snapshot) => void) {
  const s = getSnapshot();
  change(s);
  return saveSnapshot(s);
}

test('image alt and caption translation saves only the chosen language in one revision', async () => {
  const before = getSnapshot();
  const translated = await translate(mediaRequest());
  const expected = structuredClone(before);
  expected.revision++;
  expected.media[0].alt.fr = `FR ${before.media[0].alt.en}`;
  expected.media[0].caption.fr = `FR ${before.media[0].caption.en}`;
  assert.deepEqual(translated, expected);
  assert.deepEqual(getSnapshot(), expected);
  assert.deepEqual(calls[0].source, {
    alt: before.media[0].alt.en,
    caption: before.media[0].caption.en,
  });
  assert.match(calls[0].system, /from en to fr/);
});

test('empty optional captions are omitted from requests and remain empty after overwrite', async () => {
  edit((s) => {
    s.media[0].caption.en = '';
  });
  const translated = await translate(mediaRequest());
  assert.deepEqual(Object.keys(calls[0].source), ['alt']);
  assert.equal(translated.media[0].caption.fr, '');
  assert.ok(translated.media[0].alt.fr.startsWith('FR '));
  const before = getSnapshot();
  mockAI((source) => ({ ...source, caption: 'Invented caption' }));
  await assert.rejects(() => translate(mediaRequest()), { status: 502 });
  assert.deepEqual(getSnapshot(), before);
});

test('caption-only metadata can translate, but entirely blank sources never call a provider', async () => {
  edit((s) => {
    s.media[0].alt.en = '';
  });
  const translated = await translate(mediaRequest());
  assert.equal(translated.media[0].alt.fr, '');
  assert.deepEqual(Object.keys(calls[0].source), ['caption']);
  edit((s) => {
    s.media[0].caption.en = '';
  });
  const before = getSnapshot(),
    count = calls.length;
  await assert.rejects(() => translate(mediaRequest()), { status: 400 });
  assert.equal(calls.length, count);
  assert.deepEqual(getSnapshot(), before);
});

test('metadata defaults to site source locale and protects any existing target text', async () => {
  await assert.rejects(() => translate(mediaRequest({ overwrite: false })), { status: 409 });
  assert.equal(calls.length, 0);
  const translated = await translate(mediaRequest({ sourceLocale: undefined }));
  assert.equal(translated.media[0].alt.fr, `FR ${seed.media[0].alt['zh-CN']}`);
  assert.match(calls[0].system, /from zh-CN to fr/);
  await assert.rejects(() => translate(sectionRequest({ targetLocale: 'zh-CN' })), { status: 409 });
  await assert.rejects(() => translate(sectionRequest({ targetLocale: 'en' })), { status: 400 });
});

test('custom section title and Markdown body translation preserves structure, cards and other locales', async () => {
  const before = getSnapshot();
  const translated = await translate(sectionRequest());
  const expected = structuredClone(before);
  expected.revision++;
  expected.settings.sections.at(-1)!.titles!.fr = 'FR Notes';
  expected.settings.sections.at(-1)!.body!.fr = `FR ${section.body!.en}`;
  assert.deepEqual(translated, expected);
  assert.deepEqual(calls[0].source, { title: section.titles!.en, body: section.body!.en });
  assert.equal('reviewed' in translated.settings.sections.at(-1)!, false);
});

test('title-only custom sections and default built-in headings can be translated', async () => {
  edit((s) => {
    delete s.settings.sections.at(-1)!.body;
  });
  const translated = await translate(sectionRequest());
  assert.equal(translated.settings.sections.at(-1)!.body, undefined);
  assert.deepEqual(Object.keys(calls[0].source), ['title']);
  const withBuiltin = await translate(sectionRequest({ sectionId: 'about', overwrite: true }));
  assert.deepEqual(withBuiltin.settings.sections[0].titles, {
    'zh-CN': '关于',
    en: 'About',
    fr: 'FR About',
  });
  assert.equal(withBuiltin.settings.sections[0].body, undefined);
  assert.deepEqual(calls[1].source, { title: 'About' });
});

test('exactly one target is required and arbitrary source overrides cannot affect entries or profiles', async () => {
  const before = getSnapshot();
  for (const request of [
    { targetLocale: 'fr' },
    { ...mediaRequest(), sectionId: section.id },
    { ...mediaRequest(), profile: true },
    { ...mediaRequest(), entryId: seed.entries[0].id },
    { profile: true, sourceLocale: 'en', targetLocale: 'fr' },
    { entryId: seed.entries[0].id, sourceLocale: 'en', targetLocale: 'fr' },
    { profile: true, entryId: '', targetLocale: 'fr' },
  ])
    await assert.rejects(() => translate(request));
  await assert.rejects(() => translate(mediaRequest({ mediaId: 'missing-image' })), {
    status: 404,
  });
  await assert.rejects(() => translate(sectionRequest({ sectionId: 'section-missing' })), {
    status: 404,
  });
  assert.deepEqual(getSnapshot(), before);
  assert.equal(calls.length, 0);
});

test('malformed, missing, whitespace-only and oversized metadata results never partially save', async () => {
  const before = getSnapshot();
  for (const response of [
    {},
    { alt: 'Only one field' },
    { alt: ' ', caption: 'Caption' },
    { alt: 'a'.repeat(1001), caption: 'Caption' },
    { alt: 'Alternative', caption: 'c'.repeat(5001) },
    { alt: 'Alternative', caption: 'Caption', path: '/media/other.webp' },
  ]) {
    mockAI(() => response);
    await assert.rejects(() => translate(mediaRequest()), { status: 502 });
    assert.deepEqual(getSnapshot(), before);
  }
  for (const response of [
    { title: 't'.repeat(121), body: section.body!.en },
    { title: 'Notes', body: 'b'.repeat(50001) },
  ]) {
    mockAI(() => response);
    await assert.rejects(() => translate(sectionRequest()), { status: 502 });
    assert.deepEqual(getSnapshot(), before);
  }
});

test('changed URLs or code invalidate the complete section translation atomically', async () => {
  const before = getSnapshot();
  for (const body of [
    'Read [this](https://different.example) and use `code`.',
    'Read [this](https://example.com/notes) and use `changed`.',
  ]) {
    mockAI((source) => ({ ...source, body }));
    await assert.rejects(() => translate(sectionRequest()), { status: 502 });
    assert.deepEqual(getSnapshot(), before);
  }
});

test('concurrent editing survives a translation response without partial metadata updates', async () => {
  let expected: Snapshot;
  mockAI((source) => {
    expected = edit((s) => {
      s.settings.accent = '#abcdef';
    });
    return source;
  });
  await assert.rejects(() => translate(mediaRequest()), { status: 409 });
  assert.deepEqual(getSnapshot(), expected!);
});

test('free translation supports metadata and preserves drafts on quota failure', async () => {
  let quota = true;
  const pairs: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.mymemory.translated.net');
    pairs.push(url.searchParams.get('langpair')!);
    return new Response(
      JSON.stringify({
        responseStatus: quota ? 429 : 200,
        responseData: { translatedText: quota ? 'Quota exhausted' : 'Traduit' },
      }),
    );
  }) as typeof fetch;
  const before = getSnapshot();
  await assert.rejects(() => translate(mediaRequest({ provider: 'mymemory' })), { status: 429 });
  assert.deepEqual(getSnapshot(), before);
  quota = false;
  const translated = await translate(mediaRequest({ provider: 'mymemory' }));
  assert.equal(translated.media[0].alt.fr, 'Traduit');
  assert.equal(translated.media[0].caption.fr, 'Traduit');
  const translatedSection = await translate(sectionRequest({ provider: 'mymemory' }));
  assert.ok(
    translatedSection.settings.sections.at(-1)!.body!.fr.includes('https://example.com/notes'),
  );
  assert.ok(translatedSection.settings.sections.at(-1)!.body!.fr.includes('`code`'));
  assert.deepEqual(new Set(pairs), new Set(['en|fr']));
});

test('profile and entry translation retain review and source hash semantics', async () => {
  const before = getSnapshot();
  const entryId = before.entries[0].id;
  await assert.rejects(() => translate({ entryId, targetLocale: 'fr', provider: 'openai' }), {
    status: 409,
  });
  const translated = await translate({
    entryId,
    targetLocale: 'fr',
    overwrite: true,
    provider: 'openai',
  });
  const entry = translated.entries[0];
  assert.equal(entry.translations.fr.reviewed, false);
  assert.equal(
    entry.translations.fr.sourceHash,
    contentHash(entry.translations[entry.sourceLocale]),
  );
  const reviewed = review({ entryId, locale: 'fr' });
  assert.equal(reviewed.entries[0].translations.fr.reviewed, true);
  const profile = await translate({
    profile: true,
    targetLocale: 'fr',
    overwrite: true,
    provider: 'openai',
  });
  assert.equal(profile.settings.profile.fr.reviewed, false);
  assert.equal(
    profile.settings.profile.fr.sourceHash,
    contentHash(profile.settings.profile[profile.settings.sourceLocale]),
  );
  assert.equal(review({ profile: true, locale: 'fr' }).settings.profile.fr.reviewed, true);
});
