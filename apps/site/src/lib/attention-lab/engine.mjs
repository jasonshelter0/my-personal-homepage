// Small, deterministic single-head attention. No Python interpreter or network runtime.
export const missionIds = ['scores', 'scale', 'axis', 'causal', 'values', 'capstone'];
export const correct = Object.freeze({
  orientation: 'qk',
  scale: true,
  axis: -1,
  causal: false,
  values: 'v',
});
export const starters = {
  scores: { ...correct, orientation: 'kq' },
  scale: { ...correct, scale: false },
  axis: { ...correct, axis: 0 },
  causal: { ...correct, causal: false },
  values: { ...correct, values: 'k' },
  capstone: { orientation: 'kq', scale: false, axis: 0, causal: false, values: 'k' },
};
export function targetSettings(id) {
  return { ...correct, causal: id === 'causal' || id === 'capstone' };
}
export function fixture(index = 0) {
  if (!Number.isInteger(index) || index < 0 || index > 2) throw Error('fixture');
  const n = index === 1 ? 3 : 4,
    d = index === 2 ? 4 : 2;
  return {
    q: Array.from({ length: n }, (_, i) =>
      Array.from({ length: d }, (_, j) => (((i * 7 + j * 3 + index * 2) % 9) - 4) / 2),
    ),
    k: Array.from({ length: n }, (_, i) =>
      Array.from({ length: d }, (_, j) => (((i * 3 + j * 5 + index + 2) % 11) - 5) / 2),
    ),
    v: Array.from({ length: n }, (_, i) => [i - 1 + index / 2, ((i * 3 + index) % 5) - 2]),
  };
}
function matrix(a) {
  if (
    !Array.isArray(a) ||
    a.length < 1 ||
    a.length > 8 ||
    !Array.isArray(a[0]) ||
    a[0].length < 1 ||
    a[0].length > 8 ||
    a.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== a[0].length ||
        row.some((v) => !Number.isFinite(v) || Math.abs(v) > 100),
    )
  )
    throw Error('limit');
}
export function settings(value) {
  if (
    !value ||
    !['qk', 'kq'].includes(value.orientation) ||
    typeof value.scale !== 'boolean' ||
    ![-1, 0].includes(value.axis) ||
    typeof value.causal !== 'boolean' ||
    !['v', 'k'].includes(value.values)
  )
    throw Error('settings');
  return Object.fromEntries(Object.keys(correct).map((k) => [k, value[k]]));
}
export function attention(input, configuration = correct, temperature = 1) {
  const s = settings(configuration),
    { q, k, v } = input;
  [q, k, v].forEach(matrix);
  const n = q.length,
    d = q[0].length;
  if (k.length !== n || v.length !== n || k[0].length !== d) throw Error('shape');
  if (!Number.isFinite(temperature) || temperature < 0.25 || temperature > 2)
    throw Error('temperature');
  const left = s.orientation === 'qk' ? q : k,
    right = s.orientation === 'qk' ? k : q;
  const raw = left.map((row) =>
    right.map((col) => row.reduce((sum, val, i) => sum + val * col[i], 0)),
  );
  const divisor = (s.scale ? Math.sqrt(d) : 1) * temperature;
  const logits = raw.map((row, i) =>
    row.map((x, j) => (s.causal && j > i ? -Infinity : x / divisor)),
  );
  const weights = Array.from({ length: n }, () => Array(n).fill(0));
  for (let outer = 0; outer < n; outer++) {
    const scores = Array.from({ length: n }, (_, inner) =>
      s.axis === -1 ? logits[outer][inner] : logits[inner][outer],
    );
    const max = Math.max(...scores),
      exps = scores.map((x) => Math.exp(x - max)),
      sum = exps.reduce((a, b) => a + b, 0);
    exps.forEach((x, inner) => {
      if (s.axis === -1) weights[outer][inner] = x / sum;
      else weights[inner][outer] = x / sum;
    });
  }
  const values = s.values === 'v' ? v : k;
  const output = weights.map((row) =>
    values[0].map((_, col) => row.reduce((sum, w, i) => sum + w * values[i][col], 0)),
  );
  return { raw, logits, weights, output, values, left, right, divisor, settings: s, temperature };
}
export function maxDifference(a, b) {
  if (a.length !== b.length || a.some((row, i) => row.length !== b[i].length)) return Infinity;
  return Math.max(0, ...a.flatMap((row, i) => row.map((value, j) => Math.abs(value - b[i][j]))));
}
export function futureEffect(input, configuration, temperature = 1) {
  const changed = structuredClone(input),
    last = input.k.length - 1;
  changed.k[last] = changed.k[last].map((x) => x + 3);
  changed.v[last] = changed.v[last].map((x) => x + 6);
  const original = attention(input, configuration, temperature),
    altered = attention(changed, configuration, temperature);
  return {
    original: original.output[0],
    altered: altered.output[0],
    delta: maxDifference([original.output[0]], [altered.output[0]]),
  };
}
export function validate(id, configuration) {
  if (!missionIds.includes(id)) throw Error('mission');
  for (let i = 0; i < 3; i++) {
    const data = fixture(i),
      actual = attention(data, configuration),
      expected = attention(data, targetSettings(id));
    const field =
      id === 'scores' ? 'raw' : id === 'values' || id === 'capstone' ? 'output' : 'weights';
    if (maxDifference(actual[field], expected[field]) > 1e-9) return false;
    if ((id === 'causal' || id === 'capstone') && futureEffect(data, configuration).delta > 1e-9)
      return false;
  }
  return true;
}
export function exportPython(input, configuration, temperature = 1) {
  const s = settings(configuration);
  attention(input, s, temperature); // Apply the same bounds before exporting.
  return `import math\nimport torch\n\nq = torch.tensor(${JSON.stringify(input.q)}, dtype=torch.float64)\nk = torch.tensor(${JSON.stringify(input.k)}, dtype=torch.float64)\nv = torch.tensor(${JSON.stringify(input.v)}, dtype=torch.float64)\n\nscores = ${s.orientation === 'qk' ? 'q @ k.T' : 'k @ q.T'}\nscores = scores / (${s.scale ? 'math.sqrt(q.shape[-1])' : '1.0'} * ${temperature})\n${s.causal ? "allowed = torch.ones_like(scores, dtype=torch.bool).tril()\nscores = scores.masked_fill(~allowed, float('-inf'))\n" : ''}weights = torch.softmax(scores, dim=${s.axis})\noutput = weights @ ${s.values}\nprint('weights:', weights)\nprint('row sums:', weights.sum(dim=-1))\nprint('output:', output)\n`;
}
export function encodeState(state) {
  const normalized = decodeState(
    `#attention-${state.mission}?${new URLSearchParams({ v: '1', e: String(state.example), r: String(state.row), c: String(state.column), t: String(state.temperature), o: state.settings.orientation, s: state.settings.scale ? '1' : '0', a: String(state.settings.axis), m: state.settings.causal ? '1' : '0', x: state.settings.values })}`,
  );
  return `#attention-${normalized.mission}?${new URLSearchParams({ v: '1', e: String(normalized.example), r: String(normalized.row), c: String(normalized.column), t: String(normalized.temperature), o: normalized.settings.orientation, s: normalized.settings.scale ? '1' : '0', a: String(normalized.settings.axis), m: normalized.settings.causal ? '1' : '0', x: normalized.settings.values })}`;
}
export function decodeState(hash = '') {
  if (hash.length > 500) throw Error('link');
  const [path, query] = hash.split('?'),
    id = path.replace(/^#attention-/, '') || 'scores';
  if (!missionIds.includes(id)) throw Error('link');
  const base = {
    mission: id,
    example: 0,
    row: 0,
    column: 0,
    temperature: 1,
    settings: { ...starters[id] },
  };
  if (!query) return base;
  const p = new URLSearchParams(query),
    keys = ['v', 'e', 'r', 'c', 't', 'o', 's', 'a', 'm', 'x'];
  if (
    keys.some((k) => p.getAll(k).length !== 1) ||
    [...p.keys()].some((k) => !keys.includes(k)) ||
    p.get('v') !== '1' ||
    !['0', '1'].includes(p.get('s')) ||
    !['0', '1'].includes(p.get('m')) ||
    ['e', 'r', 'c', 't', 'a'].some((k) => !p.get(k)?.trim())
  )
    throw Error('link');
  const example = Number(p.get('e')),
    row = Number(p.get('r')),
    column = Number(p.get('c')),
    temperature = Number(p.get('t'));
  const data = fixture(example);
  if (![row, column].every((n) => Number.isInteger(n) && n >= 0 && n < data.q.length))
    throw Error('link');
  const config = settings({
    orientation: p.get('o'),
    scale: p.get('s') === '1',
    axis: Number(p.get('a')),
    causal: p.get('m') === '1',
    values: p.get('x'),
  });
  attention(data, config, temperature);
  return { ...base, example, row, column, temperature, settings: config };
}
