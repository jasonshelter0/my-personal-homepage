import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ucit, ucitVersion } from '../apps/site/src/lib/ucit.ts';
test('generated UCIT guide has exact provenance and complete equivalent locales', () => {
  const raw = fs.readFileSync(new URL('../apps/site/src/content/ucit/usage.json', import.meta.url));
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), ucitVersion.docsSha256);
  assert.equal(ucit.pluginVersion, ucitVersion.pluginVersion);
  for (const locale of ['zh-CN', 'en', 'fr'] as const) {
    const guide = ucit.locales[locale];
    assert.equal(guide.states.map(s => s.code).join(''), 'PAWSC');
    assert.deepEqual(guide.sections.map(s => s.id), ['install','start','routine','calendar','fields','help','updates']);
    assert.match(guide.sections.find(s => s.id === 'start')!.body, /ucit_version: 2/);
    assert.match(guide.sections.find(s => s.id === 'fields')!.body, /`parent`/);
    assert.doesNotMatch(JSON.stringify(guide), /\/home\/jasonshelter|CVPR2027|RCP-001|MO-102/);
  }
});
