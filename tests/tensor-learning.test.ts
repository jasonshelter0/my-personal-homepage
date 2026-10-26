import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tensorLearningCopy } from '../apps/site/src/lib/tensor-learning';
test('tensor engine, interpreter, lesson validation and Python export', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const output = execFileSync(process.execPath, ['--test', 'tests/tensor-lab/engine.test.mjs'], { encoding: 'utf8', env });
  assert.match(output, /tests 11/);
});
test('all tensor lesson translations have the same complete schema', () => {
  function paths(value: unknown, prefix = ''): string[] {
    if (typeof value === 'string') { assert.ok(value.trim(), prefix); return [prefix]; }
    return Object.entries(value as object).flatMap(([key, child]) => paths(child, `${prefix}.${key}`));
  }
  const expected = paths(tensorLearningCopy.en);
  for (const copy of Object.values(tensorLearningCopy)) assert.deepEqual(paths(copy), expected);
});
