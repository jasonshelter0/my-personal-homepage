import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonsByLocale, learningPaths, lessonPath, renderLessonBody } from '../apps/site/src/lib/learning';

test('all three languages retain the complete course and educational interactions', () => {
  const zh = lessonsByLocale['zh-CN'];
  assert.equal(zh.length, 11);
  assert.equal(new Set(learningPaths).size, 11);
  for (const [locale, lessons] of Object.entries(lessonsByLocale)) {
    assert.deepEqual(lessons.map((x) => x.slug), zh.map((x) => x.slug));
    for (let i = 0; i < lessons.length; i++) {
      const page = lessons[i];
      assert.ok(page.label && page.title && page.lede && page.body && page.minutes);
      assert.deepEqual([...page.body.matchAll(/data-demo="([^"]+)"/g)].map((m) => m[1]), [...zh[i].body.matchAll(/data-demo="([^"]+)"/g)].map((m) => m[1]));
      assert.deepEqual([...page.body.matchAll(/data-answer="([^"]+)"/g)].map((m) => m[1]), [...zh[i].body.matchAll(/data-answer="([^"]+)"/g)].map((m) => m[1]));
      assert.equal((page.body.match(/<section\b/g) || []).length, (zh[i].body.match(/<section\b/g) || []).length);
      if (locale !== 'zh-CN') assert.doesNotMatch(JSON.stringify(page), /[\u3400-\u9fff]/, `${locale}/${page.slug} must be fully translated`);
    }
  }
});

test('reviewed lesson HTML keeps interactions but strips active markup and honors preview links', () => {
  const input = '<section class="quiz" data-answer="1" data-explanation="Check"><input type="radio" value="1" name="q"><button type="button">Check</button></section><div data-demo="entropy"></div><a href="tent.html">Tent</a><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">Unsafe</a>';
  const output = renderLessonBody(input, (path) => '/preview/test-release/en/' + path + '/');
  assert.match(output, /data-demo="entropy"/);
  assert.match(output, /data-answer="1"/);
  assert.match(output, /\/preview\/test-release\/en\/learn\/mamba-tta-irstd\/tent\//);
  assert.doesNotMatch(output, /script|onerror|javascript:/);
  assert.equal(lessonPath(), 'learn/mamba-tta-irstd');
});
