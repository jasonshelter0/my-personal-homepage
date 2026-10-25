import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gitLearningCopy } from '../apps/site/src/lib/git-learning';

test('Git lesson has complete localized content and a portable simulator', () => {
  for (const [locale, copy] of Object.entries(gitLearningCopy)) {
    assert.equal(copy.steps.length, 3);
    assert.equal(copy.concepts.length, 4);
    for (const value of Object.values(copy)) assert.ok(value.length > 0);
    if (locale !== 'zh-CN') assert.doesNotMatch(JSON.stringify(copy), /[\u3400-\u9fff]/);
  }
  const html = fs.readFileSync('apps/site/public/learn-assets/git-branching/simulator.html', 'utf8');
  assert.doesNotMatch(html, /<script\b[^>]+\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b[^>]*rel="(?:stylesheet|modulepreload)"/i);
  assert.match(html, /website-trilingual-3/);
  assert.match(html, /id="pocketStorageNotice"/);
  assert.match(html, /data-move="up"/);
  assert.match(html, /data-move="down"/);
  assert.match(fs.readFileSync('apps/site/public/learn-assets/git-branching/LICENSE.txt', 'utf8'), /Peter Cottle/);
});
