// Deliberately bounded interpreter. User input is never passed to eval/Function.
const LIMIT = 4096;
export const size = shape => shape.reduce((a, b) => a * b, 1);
export const stridesFor = shape => shape.map((_, i) => size(shape.slice(i + 1)));
const indices = (i, shape) => stridesFor(shape).map((s, d) => Math.floor(i / s) % shape[d]);
const shapeText = shape => `[${shape.join(', ')}]`;
let nextStorage = 1;
export class Tensor {
  constructor(data, shape, options = {}) {
    if (shape.length > 4 || shape.some(d => !Number.isInteger(d) || d < 1) || size(shape) > LIMIT) throw Error('Use 1–4 axes, positive dimensions, and at most 4096 elements.');
    this.shape = [...shape];
    this.strides = options.strides || stridesFor(shape);
    this.storage = options.storage || { id: nextStorage++, data: [...data] };
    this.offset = options.offset || 0;
    this.operation = options.operation || null;
    this.axes = options.axes || shape.map((_, i) => `axis ${i}`);
    this.note = options.note || 'A new tensor with its own storage.';
    if (!options.storage && data.length !== size(shape)) throw Error('Data length does not match the shape.');
  }
  at(coords) { return this.storage.data[this.offset + coords.reduce((s, x, d) => s + x * this.strides[d], 0)]; }
  get values() { return Array.from({ length: size(this.shape) }, (_, i) => this.at(indices(i, this.shape))); }
  get contiguous() { let s = 1; for (let i = this.shape.length - 1; i >= 0; i--) { if (this.shape[i] !== 1 && this.strides[i] !== s) return false; s *= this.shape[i]; } return true; }
  permute(...dims) {
    if (Array.isArray(dims[0])) dims = dims[0];
    dims = dims.map(d => axis(d, this.shape.length));
    if (dims.length !== this.shape.length || new Set(dims).size !== dims.length) throw Error('permute needs each axis exactly once.');
    return new Tensor([], dims.map(d => this.shape[d]), { storage: this.storage, strides: dims.map(d => this.strides[d]), offset: this.offset, axes: dims.map(d => this.axes[d]), note: 'Axes reordered. Values keep their identity; underlying storage is shared, not rearranged.' });
  }
  transpose(a, b) { a = axis(a, this.shape.length); b = axis(b, this.shape.length); const dims = this.shape.map((_, i) => i); [dims[a], dims[b]] = [dims[b], dims[a]]; return this.permute(...dims); }
  reshape(...shape) {
    if (Array.isArray(shape[0])) shape = [...shape[0]];
    if (shape.filter(d => d === -1).length > 1) throw Error('Only one dimension can be inferred with -1.');
    if (shape.includes(-1)) { const j = shape.indexOf(-1); shape[j] = size(this.shape) / -size(shape); }
    if (size(shape) !== size(this.shape)) throw Error(`reshape must preserve all ${size(this.shape)} elements. Requested ${shapeText(shape)}.`);
    if (this.contiguous) return new Tensor([], shape, { storage: this.storage, offset: this.offset, note: 'Logical element order preserved. This contiguous input can share storage.' });
    return new Tensor(this.values, shape, { note: 'Logical element order preserved. This simulator copies a noncontiguous input when reshaping.' });
  }
  flatten(start = 0, end = -1) {
    const rank = Math.max(1, this.shape.length);
    start = axis(start, rank); end = axis(end, rank);
    if (start > end) throw Error('Axis start_dim must not follow end_dim.');
    if (!this.shape.length) return this.reshape(1);
    if (start === end) return this;
    const result = this.reshape(...this.shape.slice(0, start), size(this.shape.slice(start, end + 1)), ...this.shape.slice(end + 1));
    result.axes = [...this.axes.slice(0, start), 'feature', ...this.axes.slice(end + 1)];
    result.note = 'Flatten merges a range of axes in logical order. Axes outside that range stay in place.';
    return result;
  }
  softmax(dim) {
    dim = axis(dim, Math.max(1, this.shape.length));
    if (!this.shape.length) return new Tensor([1], []);
    const data = Array(size(this.shape));
    const other = this.shape.filter((_, i) => i !== dim), strides = stridesFor(this.shape);
    for (let i = 0; i < size(other); i++) {
      const coords = indices(i, other); coords.splice(dim, 0, 0);
      const values = Array.from({length: this.shape[dim]}, (_, j) => { coords[dim] = j; return this.at(coords); });
      const max = Math.max(...values), weights = values.map(v => Math.exp(v - max));
      const total = weights.reduce((a, b) => a + b, 0);
      weights.forEach((v, j) => { coords[dim] = j; data[coords.reduce((n, c, k) => n + c * strides[k], 0)] = v / total; });
    }
    return new Tensor(data, this.shape, {axes: [...this.axes], note: 'Softmax normalizes along one axis. Each group sums to one; subtracting its maximum keeps exponentials stable.'});
  }
  unsqueeze(dim) {
    dim = axis(dim, this.shape.length + 1); const shape = [...this.shape], strides = [...this.strides], axes = [...this.axes];
    shape.splice(dim, 0, 1); strides.splice(dim, 0, dim >= this.shape.length ? 1 : this.strides[dim] * this.shape[dim]); axes.splice(dim, 0, 'singleton');
    return new Tensor([], shape, { storage: this.storage, offset: this.offset, strides, axes, note: 'A size-one axis was inserted. No values were copied.' });
  }
  squeeze(dim) {
    const remove = dim === undefined ? this.shape.map((d, i) => d === 1 ? i : -1) : [axis(dim, this.shape.length)].filter(i => this.shape[i] === 1);
    return new Tensor([], this.shape.filter((_, i) => !remove.includes(i)), { storage: this.storage, offset: this.offset, strides: this.strides.filter((_, i) => !remove.includes(i)), axes: this.axes.filter((_, i) => !remove.includes(i)), note: 'Size-one axes removed; storage is shared.' });
  }
  reduce(dim, keepdim, mean) {
    if (dim === undefined) return new Tensor([this.values.reduce((a, b) => a + b, 0) / (mean ? size(this.shape) : 1)], []);
    dim = axis(dim, this.shape.length);
    const shape = this.shape.filter((_, i) => i !== dim), axes = this.axes.filter((_, i) => i !== dim);
    const data = Array.from({ length: size(shape) }, (_, i) => {
      const c = indices(i, shape); c.splice(dim, 0, 0); let v = 0;
      for (let j = 0; j < this.shape[dim]; j++) { c[dim] = j; v += this.at(c); }
      return v / (mean ? this.shape[dim] : 1);
    });
    if (keepdim) { shape.splice(dim, 0, 1); axes.splice(dim, 0, this.axes[dim]); }
    return new Tensor(data, shape, { axes, note: `${mean ? 'Mean' : 'Sum'} along axis ${dim} (${this.axes[dim]}). ${keepdim ? 'The reduced axis stays size 1 for broadcasting.' : 'The reduced axis is removed.'}` });
  }
}
function axis(d, rank) { if (!Number.isInteger(d) || d < -rank || d >= rank) throw Error(`Axis ${d} is out of range for ${rank} axes.`); return d < 0 ? d + rank : d; }
export function broadcastShape(a, b) {
  const n = Math.max(a.length, b.length), out = [];
  for (let i = 0; i < n; i++) {
    const x = a[a.length - n + i] ?? 1, y = b[b.length - n + i] ?? 1;
    if (x !== y && x !== 1 && y !== 1) throw Error(`Cannot broadcast ${shapeText(a)} with ${shapeText(b)}: align axes from the right; ${x} and ${y} must match or one must be 1. Try keeping or inserting a size-one axis.`);
    out.push(Math.max(x, y));
  }
  return out;
}
function broadcastCoords(coords, shape) { return coords.slice(coords.length - shape.length).map((v, i) => shape[i] === 1 ? 0 : v); }
export function binary(a, b, op) {
  if (!(a instanceof Tensor)) a = new Tensor([a], []);
  if (!(b instanceof Tensor)) b = new Tensor([b], []);
  const shape = broadcastShape(a.shape, b.shape);
  if (size(shape) > LIMIT) throw Error('Result exceeds the 4096-element limit.');
  const data = Array.from({ length: size(shape) }, (_, i) => { const c = indices(i, shape), x = a.at(broadcastCoords(c, a.shape)), y = b.at(broadcastCoords(c, b.shape)); return op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : x / y; });
  if (data.some(x => !Number.isFinite(x))) throw Error('This calculation produced a non-finite value. Check division by zero.');
  return new Tensor(data, shape, { operation: {kind:'binary', operator:op, left:a, right:b}, axes: a.shape.length >= b.shape.length ? a.axes : b.axes, note: `${shapeText(a.shape)} ${op} ${shapeText(b.shape)} → ${shapeText(shape)}. Size-one axes reuse input values; the result has new storage.` });
}
export function matmul(a, b) {
  if (!(a instanceof Tensor) || !(b instanceof Tensor) || a.shape.length < 2 || b.shape.length < 2) throw Error('This lab supports @ on matrices and batched matrices (rank 2–4).');
  const m = a.shape.at(-2), k = a.shape.at(-1), n = b.shape.at(-1);
  if (k !== b.shape.at(-2)) throw Error(`Matrix multiplication needs matching inner dimensions: ${shapeText(a.shape)} @ ${shapeText(b.shape)} has ${k} versus ${b.shape.at(-2)}. Consider transpose(-2, -1).`);
  const batch = broadcastShape(a.shape.slice(0, -2), b.shape.slice(0, -2)), shape = [...batch, m, n];
  if (size(shape) > LIMIT) throw Error('Result exceeds the 4096-element limit.');
  const data = Array.from({ length: size(shape) }, (_, i) => {
    const c = indices(i, shape), bc = c.slice(0, -2); let sum = 0;
    for (let j = 0; j < k; j++) sum += a.at([...broadcastCoords(bc, a.shape.slice(0, -2)), c.at(-2), j]) * b.at([...broadcastCoords(bc, b.shape.slice(0, -2)), j, c.at(-1)]);
    return sum;
  });
  const batchAxes = a.shape.length >= b.shape.length ? a.axes.slice(0, -2) : b.axes.slice(0, -2);
  return new Tensor(data, shape, { operation: {kind:'matmul', left:a, right:b}, axes: [...batchAxes, a.axes.at(-2), b.axes.at(-1)], note: `Inner axes of size ${k} are contracted. Each output cell is a dot product; leading batch axes broadcast.` });
}
export function fromNested(value) {
  const shape = []; let p = value;
  while (Array.isArray(p)) { if (!p.length) throw Error('Empty tensors are outside this lab’s scope.'); shape.push(p.length); p = p[0]; }
  const flat = [];
  function visit(v, d) { if (d === shape.length) { if (typeof v !== 'number' || !Number.isFinite(v)) throw Error('Tensor values must be finite numbers.'); flat.push(v); } else { if (!Array.isArray(v) || v.length !== shape[d]) throw Error('Tensor rows must have equal lengths.'); v.forEach(x => visit(x, d + 1)); } }
  visit(value, 0); return new Tensor(flat, shape);
}
const methods = new Set(['reshape', 'permute', 'transpose', 'unsqueeze', 'squeeze', 'mean', 'sum', 'flatten', 'softmax']);
export function execute(code, initial) {
  if (code.length > 6000) throw Error('Keep your experiment under 6000 characters.');
  const env = { ...initial }, trace = [];
  let operationCount = 0;
  function record(label, value) { if (value instanceof Tensor) { if (++operationCount > 100) throw Error('Use at most 100 operations.'); trace.push({ label, tensor: value }); } return value; }
  const lines = code.split('\n');
  for (let line = 0; line < lines.length; line++) {
    const source = lines[line].split('#')[0].trim(); if (!source) continue;
    try {
      const tokens = []; const regex = /\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)|([A-Za-z_]\w*)|([()[\],.=+*/@-]))/y; let pos = 0;
      while (pos < source.length) { regex.lastIndex = pos; const match = regex.exec(source); if (!match) throw Error(`Unsupported syntax near “${source.slice(pos, pos + 20)}”. Open the API guide for supported expressions.`); tokens.push(match[1] ? Number(match[1]) : match[2] || match[3]); pos = regex.lastIndex; }
      let t = 0;
      const peek = () => tokens[t]; const take = () => tokens[t++]; const expect = value => { if (take() !== value) throw Error(`Expected “${value}”.`); };
      function args() {
        expect('('); const positional = [], named = {};
        while (peek() !== ')') {
          if (t >= tokens.length) throw Error('Missing closing parenthesis.');
          if (typeof peek() === 'string' && tokens[t + 1] === '=') { const key = take(); take(); if (!['dim', 'keepdim', 'start_dim', 'end_dim'].includes(key) || key in named) throw Error(`Unsupported or duplicate keyword ${key}.`); named[key] = expr(); }
          else { if (Object.keys(named).length) throw Error('Positional arguments must precede keyword arguments.'); positional.push(expr()); }
          if (peek() !== ',') break; take();
        }
        expect(')'); return { positional, named };
      }
      function atom() {
        let v, token = take();
        if (token === '-') { const x = atom(); v = x instanceof Tensor ? binary(x, -1, '*') : -x; }
        else if (typeof token === 'number') v = token;
        else if (token === 'True' || token === 'False') v = token === 'True';
        else if (token === '(') { v = expr(); expect(')'); }
        else if (token === '[') { v = []; while (peek() !== ']') { if (t >= tokens.length) throw Error('Missing closing bracket.'); v.push(expr()); if (peek() !== ',') break; take(); } expect(']'); }
        else if (token === 'torch') {
          expect('.'); const fn = take(), { positional: p, named } = args(); if (Object.keys(named).length) throw Error('torch constructors accept positional arguments in this lab.');
          if (fn === 'tensor' && p.length === 1) v = fromNested(p[0]);
          else if (fn === 'arange' && p.length === 1 && Number.isInteger(p[0]) && p[0] > 0 && p[0] <= LIMIT) v = new Tensor(Array.from({ length: p[0] }, (_, i) => i), [p[0]]);
          else if (['ones', 'zeros'].includes(fn)) { const s = Array.isArray(p[0]) && p.length === 1 ? p[0] : p; if (!s.length || size(s) > LIMIT || s.some(x => !Number.isInteger(x) || x < 1)) throw Error('Use positive integer dimensions within 4096 elements.'); v = new Tensor(Array(size(s)).fill(fn === 'ones' ? 1 : 0), s); }
          else throw Error('Supported constructors: torch.tensor([...]), torch.arange(n), torch.ones(...), torch.zeros(...).');
          record(`torch.${fn}`, v);
        } else if (typeof token === 'string' && Object.hasOwn(env, token)) v = env[token];
        else throw Error(`Unknown name “${token ?? ''}”. Use an input tensor or assign a variable first.`);
        while (peek() === '.') {
          take(); const method = take(); if (!methods.has(method)) throw Error(`.${method} is not supported yet. Open the API guide.`);
          if (!(v instanceof Tensor)) throw Error('Tensor methods need a tensor.');
          const { positional: p, named: kw } = args();
          if (method === 'mean' || method === 'sum') {
            if (Object.keys(kw).some(k => !['dim', 'keepdim'].includes(k))) throw Error('Unsupported reduction keyword.');
            if (p.length > 2 || (p.length && 'dim' in kw) || (p.length > 1 && 'keepdim' in kw)) throw Error('Use mean(dim, keepdim=False) or sum(dim, keepdim=False).');
            const keep = kw.keepdim ?? p[1] ?? false; if (typeof keep !== 'boolean') throw Error('keepdim must be True or False.');
            v = v.reduce(kw.dim ?? p[0], keep, method === 'mean');
          } else if (method === 'flatten') {
            if (p.length > 2 || Object.keys(kw).some(k => !['start_dim', 'end_dim'].includes(k)) || (p.length && 'start_dim' in kw) || (p.length > 1 && 'end_dim' in kw)) throw Error('Use flatten(start_dim=0, end_dim=-1).');
            v = v.flatten(kw.start_dim ?? p[0] ?? 0, kw.end_dim ?? p[1] ?? -1);
          } else if (method === 'softmax') {
            if (p.length > 1 || Object.keys(kw).some(k => k !== 'dim') || (p.length && 'dim' in kw) || (!p.length && !('dim' in kw))) throw Error('Use softmax(dim) with one explicit axis.');
            v = v.softmax(kw.dim ?? p[0]);
          } else {
            if (Object.keys(kw).length) throw Error(`Use positional arguments for ${method} in this lab.`);
            if ((method === 'transpose' && p.length !== 2) || (method === 'unsqueeze' && p.length !== 1) || (method === 'squeeze' && p.length > 1)) throw Error(`Wrong number of arguments for ${method}.`);
            v = v[method](...p);
          }
          record(`.${method}()`, v);
        }
        return v;
      }
      const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '@': 2 };
      function expr(min = 0) { let v = atom(); while (Object.hasOwn(precedence, peek()) && precedence[peek()] >= min) { const op = take(), rhs = expr(precedence[op] + 1); if (!(v instanceof Tensor) && !(rhs instanceof Tensor) && op !== '@') v = op === '+' ? v + rhs : op === '-' ? v - rhs : op === '*' ? v * rhs : v / rhs; else v = record(op, op === '@' ? matmul(v, rhs) : binary(v, rhs, op)); } return v; }
      let name;
      if (typeof peek() === 'string' && tokens[t + 1] === '=') { name = take(); take(); if (!/^[a-zA-Z_]\w*$/.test(name) || ['torch', 'True', 'False', '__proto__', 'constructor', 'prototype'].includes(name)) throw Error('Choose a different variable name.'); }
      const start = trace.length, value = expr(); if (t !== tokens.length) throw Error('Unexpected syntax. Use one assignment per line.');
      if (!(value instanceof Tensor)) throw Error('Each line should produce a tensor.');
      if (name) env[name] = value;
      if (trace.length === start) record(name || 'result', value);
      trace.at(-1).label = name ? `${name} = ${source.split('=').slice(1).join('=').trim()}` : source;
      for (let i = start; i < trace.length; i++) trace[i].line = line + 1;
    } catch (error) { error.message = `Line ${line + 1}: ${error.message}`; error.trace = trace; throw error; }
  }
  return { env, trace };
}
export function equal(a, b) { return a instanceof Tensor && JSON.stringify(a.shape) === JSON.stringify(b.shape) && a.values.every((v, i) => Math.abs(v - b.values[i]) <= 1e-5 + 1e-5 * Math.abs(b.values[i])); }
