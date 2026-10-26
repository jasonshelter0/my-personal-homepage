import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attention,
  fixture,
  correct,
  missionIds,
  starters,
  targetSettings,
  validate,
  futureEffect,
  maxDifference,
  decodeState,
  encodeState,
  exportPython,
} from '../../apps/site/src/lib/attention-lab/engine.mjs';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
test('all six starters fail and repairs generalize over three fixtures', () => {
  for (const id of missionIds) {
    assert.equal(validate(id, starters[id]), false, id);
    assert.equal(validate(id, targetSettings(id)), true, id);
  }
});
test('asymmetric query/key dot products have the intended orientation', () => {
  const input = {
    q: [
      [1, 0],
      [0, 2],
    ],
    k: [
      [3, 4],
      [5, 6],
    ],
    v: [[10], [20]],
  };
  assert.deepEqual(attention(input).raw, [
    [3, 5],
    [8, 12],
  ]);
  assert.deepEqual(attention(input, { ...correct, orientation: 'kq' }).raw, [
    [3, 8],
    [5, 12],
  ]);
});
test('row normalization creates independent probability distributions', () => {
  for (let i = 0; i < 3; i++) {
    const r = attention(fixture(i));
    r.weights.forEach((row) =>
      close(
        row.reduce((a, b) => a + b, 0),
        1,
      ),
    );
    const wrong = attention(fixture(i), starters.axis);
    assert.ok(wrong.weights.some((row) => Math.abs(row.reduce((a, b) => a + b, 0) - 1) > 0.01));
  }
});
test('causal masking gives exact zeros and prevents future key/value leakage', () => {
  for (let i = 0; i < 3; i++) {
    const input = fixture(i),
      r = attention(input, targetSettings('causal'));
    r.weights.forEach((row, a) =>
      row.forEach((w, b) => {
        if (b > a) assert.equal(w, 0);
      }),
    );
    assert.equal(futureEffect(input, targetSettings('causal')).delta, 0);
    assert.ok(futureEffect(input, correct).delta > 1e-9);
  }
});
test('value mixtures equal independent weighted sums and changing V preserves weights', () => {
  const input = fixture(),
    r = attention(input);
  r.output.forEach((row, i) =>
    row.forEach((value, j) =>
      close(
        value,
        r.weights[i].reduce((sum, w, k) => sum + w * input.v[k][j], 0),
      ),
    ),
  );
  const changed = structuredClone(input);
  changed.v[0][0] += 3;
  const s = attention(changed);
  assert.deepEqual(r.weights, s.weights);
  assert.ok(maxDifference(r.output, s.output) > 0);
});
test('scale depends on feature width and temperature changes concentration', () => {
  close(attention(fixture(2)).divisor, 2);
  const input = fixture(0),
    cold = attention(input, correct, 0.5),
    hot = attention(input, correct, 2);
  assert.ok(Math.max(...cold.weights[0]) > Math.max(...hot.weights[0]));
});
test('large finite scores are normalized stably', () => {
  const input = {
    q: [
      [100, 100],
      [100, -100],
    ],
    k: [
      [100, 100],
      [-100, 100],
    ],
    v: [
      [1, 2],
      [3, 4],
    ],
  };
  const r = attention(input);
  assert.ok(r.weights.flat().every(Number.isFinite));
  r.weights.forEach((row) =>
    close(
      row.reduce((a, b) => a + b, 0),
      1,
    ),
  );
});
test('shape, allocation, finite-value and configuration bounds reject invalid input', () => {
  for (const input of [
    { q: [], k: [], v: [] },
    { ...fixture(), v: [[1]] },
    { ...fixture(), q: [[NaN]] },
    { ...fixture(), q: Array(9).fill([1, 2]) },
  ])
    assert.throws(() => attention(input));
  for (const temp of [0, Infinity, NaN, 3])
    assert.throws(() => attention(fixture(), correct, temp));
  assert.throws(() => attention(fixture(), { ...correct, axis: 1 }));
  assert.throws(() => fixture(3));
});
test('shared experiments round trip and reject malformed or oversized links', () => {
  const state = {
    mission: 'capstone',
    example: 2,
    row: 3,
    column: 2,
    temperature: 0.75,
    settings: { ...starters.capstone, scale: true },
  };
  assert.deepEqual(decodeState(encodeState(state)), state);
  assert.equal(decodeState('#attention-causal').settings.causal, false);
  for (const hash of [
    '#attention-unknown',
    '#attention-axis?v=1',
    '#attention-axis?' + 'x'.repeat(600),
    encodeState(state) + '&m=1',
    encodeState(state).replace('r=3', 'r=9'),
    encodeState(state).replace('t=0.75', 't=NaN'),
  ])
    assert.throws(() => decodeState(hash));
});
test('Python exports preserve causal masking, incorrect settings and temperature', () => {
  const s = exportPython(fixture(2), targetSettings('causal'), 0.5);
  assert.match(s, /masked_fill\(~allowed, float\('-inf'\)\)/);
  assert.match(s, /math.sqrt\(q.shape\[-1\]\) \* 0.5/);
  const bad = exportPython(fixture(), starters.capstone);
  assert.match(bad, /scores = k @ q.T/);
  assert.match(bad, /dim=0/);
  assert.match(bad, /output = weights @ k/);
  assert.doesNotMatch(bad, /masked_fill/);
});
