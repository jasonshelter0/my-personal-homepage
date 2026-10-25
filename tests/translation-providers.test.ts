import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = await mkdtemp(join(tmpdir(), 'folio-translation-test-'));
process.env.FOLIO_DATA_DIR = dir;
const { translateProse, proseSpans, utf8Chunks, translationStatus } =
  await import('../server/translation-providers.ts');
after(async () => {
  await rm(dir, { recursive: true, force: true });
});
const success = (text: string) =>
  new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: text } }), {
    headers: { 'Content-Type': 'application/json' },
  });

test('UTF-8 request chunks preserve every character and stay within 500 bytes', () => {
  for (const value of [
    '中文🙂'.repeat(100),
    'Une phrase française avec des accents. '.repeat(40),
    'x'.repeat(1500),
  ]) {
    const chunks = utf8Chunks(value);
    assert.equal(chunks.join(''), value);
    assert.ok(chunks.every((chunk) => Buffer.byteLength(chunk, 'utf8') <= 500));
    assert.ok(chunks.every((chunk) => !/\p{Surrogate}/u.test(chunk)));
  }
});

test('free translation preserves Markdown, references, code and HTML bytes while translating prose', async () => {
  const body =
    '# Hello\n\nA **strong** word and [website](https://example.com/a_(b) "Title").\n![description](/media/photo.webp) [named][ref] [ref] [ref][]\n\n[ref]: https://example.com/ref "Reference"\n\n> Quoted sentence\n> Second line\n\n- First item\n  - Nested item\n\n| Heading | Other |\n| --- | --- |\n| Value | *Emphasis* |\n\n```js\nconst secret = "leave alone";\n```\n\n~~~python\nprint("leave alone")\n~~~\n\nUse `code` and ``code with `tick` `` here. &amp; \\*escaped\\*\n\n<div data-name="keep">Raw HTML stays untouched.</div>\n';
  const seen: string[] = [];
  const translated = await translateProse({ body }, 'en', 'fr', 'mymemory', (async (input) => {
    const q = new URL(String(input)).searchParams.get('q')!;
    seen.push(q);
    return success(`FR ${q}`);
  }) as typeof fetch);
  for (const untouched of [
    'https://example.com/a_(b)',
    '"Title"',
    '/media/photo.webp',
    '[ref]',
    '[ref][]',
    '[ref]: https://example.com/ref "Reference"',
    '```js\nconst secret = "leave alone";\n```',
    '~~~python\nprint("leave alone")\n~~~',
    '`code`',
    '``code with `tick` ``',
    '&amp;',
    '\\*',
    '<div data-name="keep">Raw HTML stays untouched.</div>',
    '| --- | --- |',
  ])
    assert.ok(translated.body.includes(untouched), untouched);
  assert.match(translated.body, /^# FR Hello/);
  assert.ok(translated.body.includes('[FR website](https://example.com/a_(b) "Title")'));
  assert.ok(translated.body.includes('[FR named][ref]'));
  assert.ok(translated.body.includes('> FR Quoted sentence\n> FR Second line'));
  assert.ok(translated.body.includes('- FR First item\n  - FR Nested item'));
  assert.ok(seen.every((q) => !/https:|const secret|print\(|<div|\/media\//.test(q)));
});

test('all three language codes are sent correctly without splitting multibyte prose', async () => {
  const pairs: string[] = [];
  for (const [from, to] of [
    ['zh-CN', 'en'],
    ['en', 'fr'],
    ['fr', 'zh-CN'],
  ] as const) {
    await translateProse({ title: '测试中文文本'.repeat(80) }, from, to, 'mymemory', (async (
      input,
    ) => {
      const url = new URL(String(input));
      pairs.push(url.searchParams.get('langpair')!);
      assert.ok(Buffer.byteLength(url.searchParams.get('q')!, 'utf8') <= 500);
      assert.equal(url.origin, 'https://api.mymemory.translated.net');
      return success('Translated');
    }) as typeof fetch);
  }
  assert.deepEqual(new Set(pairs), new Set(['zh-CN|en', 'en|fr', 'fr|zh-CN']));
});

test('MyMemory budget is checked before any requests; code does not consume its prose budget', async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return success('Translated');
  }) as typeof fetch;
  await assert.rejects(
    () => translateProse({ body: 'a'.repeat(4501) }, 'en', 'fr', 'mymemory', fetcher),
    { status: 413 },
  );
  assert.equal(calls, 0);
  const code = '```text\n' + 'z'.repeat(6000) + '\n```';
  assert.equal((await translateProse({ body: code }, 'en', 'fr', 'mymemory', fetcher)).body, code);
  assert.equal(calls, 0);
});

test('provider quota errors, malformed payloads and network failures never become translated content', async () => {
  const failures: Array<[Response | Error, number]> = [
    [new Response('Limited', { status: 429 }), 429],
    [
      new Response(
        JSON.stringify({ responseStatus: 429, responseData: { translatedText: 'Quota exceeded' } }),
      ),
      429,
    ],
    [success('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS'), 429],
    [new Response(JSON.stringify({ responseStatus: 403 })), 502],
    [new Response(JSON.stringify({ responseStatus: 200, responseData: {} })), 502],
    [new Response('not JSON'), 502],
    [new Error('network unavailable'), 502],
  ];
  for (const [failure, status] of failures) {
    await assert.rejects(
      () =>
        translateProse({ title: 'Hello world' }, 'en', 'fr', 'mymemory', (async () => {
          if (failure instanceof Error) throw failure;
          return failure;
        }) as typeof fetch),
      { status },
    );
  }
});

test('translated prose cannot inject new Markdown or HTML structure', async () => {
  const result = await translateProse({ body: 'Hello' }, 'en', 'fr', 'mymemory', (async () =>
    success('<script>alert(1)</script> [x](https://bad.example)\n# Heading')) as typeof fetch);
  assert.ok(result.body.includes('\\<script\\>'));
  assert.ok(result.body.includes('\\[x\\]'));
  assert.ok(!result.body.includes('\n'));
  const list = await translateProse({ body: 'Hello' }, 'en', 'fr', 'mymemory', (async () =>
    success('1. List')) as typeof fetch);
  assert.equal(list.body, '1\\. List');
});

test('LibreTranslate uses server configuration and optional keys; status selects only configured providers', async () => {
  const saved = {
    base: process.env.LIBRETRANSLATE_URL,
    key: process.env.LIBRETRANSLATE_API_KEY,
    ai: process.env.TRANSLATION_BASE_URL,
    aiKey: process.env.TRANSLATION_API_KEY,
    model: process.env.TRANSLATION_MODEL,
  };
  try {
    delete process.env.TRANSLATION_BASE_URL;
    delete process.env.TRANSLATION_API_KEY;
    delete process.env.TRANSLATION_MODEL;
    delete process.env.LIBRETRANSLATE_URL;
    delete process.env.LIBRETRANSLATE_API_KEY;
    assert.equal(translationStatus().defaultProvider, 'mymemory');
    process.env.LIBRETRANSLATE_URL = 'https://translate.example/';
    assert.equal(translationStatus().defaultProvider, 'libretranslate');
    for (const key of [undefined, 'server-only-secret']) {
      if (key) process.env.LIBRETRANSLATE_API_KEY = key;
      const result = await translateProse(
        { title: 'Hello' },
        'en',
        'zh-CN',
        'libretranslate',
        (async (input, init) => {
          assert.equal(String(input), 'https://translate.example/translate');
          const body = JSON.parse(String(init?.body));
          assert.equal(body.target, 'zh');
          assert.equal(body.source, 'en');
          assert.equal(body.api_key, key);
          return new Response(JSON.stringify({ translatedText: '你好' }));
        }) as typeof fetch,
      );
      assert.equal(result.title, '你好');
    }
    process.env.TRANSLATION_BASE_URL = 'https://ai.example/v1';
    process.env.TRANSLATION_API_KEY = 'test';
    process.env.TRANSLATION_MODEL = 'model';
    assert.equal(translationStatus().defaultProvider, 'openai');
    assert.ok(!JSON.stringify(translationStatus()).includes('server-only-secret'));
  } finally {
    for (const [key, value] of Object.entries({
      LIBRETRANSLATE_URL: saved.base,
      LIBRETRANSLATE_API_KEY: saved.key,
      TRANSLATION_BASE_URL: saved.ai,
      TRANSLATION_API_KEY: saved.aiKey,
      TRANSLATION_MODEL: saved.model,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('plain profile and entry fields do not gain Markdown escape characters', async () => {
  const result = await translateProse(
    {
      headline: 'Hello',
      title: 'Hello',
      intro: 'Hello',
      seoDescription: 'Hello',
      body: 'Hello',
      about: 'Hello',
    },
    'en',
    'fr',
    'mymemory',
    (async () => success('R&D _Research_')) as typeof fetch,
  );
  for (const key of ['headline', 'title', 'intro', 'seoDescription'])
    assert.equal(result[key], 'R&D _Research_');
  assert.equal(result.body, 'R&D \\_Research\\_');
  assert.equal(result.about, 'R&D \\_Research\\_');
});
