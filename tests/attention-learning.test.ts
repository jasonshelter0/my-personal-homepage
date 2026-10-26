import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { attentionCopy, attentionPath } from '../apps/site/src/lib/attention-learning';
import { courseCopy, courseChapters } from '../apps/site/src/lib/pytorch-course';
import { allLearningPaths } from '../apps/site/src/lib/learning-catalog';
test('attention engine, challenges, share-state validation and exports', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const output = execFileSync(process.execPath, ['--test', 'tests/attention-lab/engine.test.mjs'], {
    env,
    encoding: 'utf8',
  });
  assert.match(output, /tests 10/);
});
test('attention and course map have complete matching translations and all 19 links', () => {
  function paths(v: unknown, p = ''): string[] {
    if (typeof v === 'string') {
      assert.ok(v.trim(), p);
      return [p];
    }
    return Object.entries(v as object).flatMap(([k, c]) => paths(c, `${p}.${k}`));
  }
  for (const locale of ['en', 'fr', 'zh-CN'] as const) {
    assert.deepEqual(paths(attentionCopy[locale]), paths(attentionCopy.en));
    assert.deepEqual(paths(courseCopy[locale]), paths(courseCopy.en));
    assert.equal(attentionCopy[locale].missions.length, 6);
    const lessons = courseChapters(locale).flatMap((c) => c.lessons);
    assert.equal(lessons.length, 19);
    assert.equal(new Set(lessons.map((l) => l.hash)).size, 19);
    if (locale !== 'zh-CN')
      assert.doesNotMatch(JSON.stringify(attentionCopy[locale]), /[\u3400-\u9fff]/);
  }
  assert.ok(allLearningPaths.includes(attentionPath));
});
