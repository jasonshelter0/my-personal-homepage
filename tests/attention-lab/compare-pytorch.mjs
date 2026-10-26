import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import {
  attention,
  fixture,
  exportPython,
  targetSettings,
} from '../../apps/site/src/lib/attention-lab/engine.mjs';
const cases = [];
for (let e = 0; e < 3; e++)
  for (const orientation of ['qk', 'kq'])
    for (const scale of [false, true])
      for (const axis of [-1, 0])
        for (const causal of [false, true])
          for (const values of ['k', 'v'])
            for (const temperature of [0.5, 1, 2]) {
              const settings = { orientation, scale, axis, causal, values };
              cases.push({
                data: fixture(e),
                settings,
                temperature,
                source: exportPython(fixture(e), settings, temperature),
              });
            }
const python = `import json,sys,torch,math,contextlib,io
cases=json.load(sys.stdin);results=[]
for c in cases:
 q,k,v=[torch.tensor(c['data'][key],dtype=torch.float64) for key in ['q','k','v']];s=c['settings'];T=c['temperature']
 raw=q@k.T if s['orientation']=='qk' else k@q.T
 scores=raw/((math.sqrt(q.shape[-1]) if s['scale'] else 1)*T)
 if s['causal']:scores=scores.masked_fill(~torch.ones_like(scores,dtype=torch.bool).tril(),float('-inf'))
 weights=scores.softmax(dim=s['axis']);output=weights@(v if s['values']=='v' else k)
 ns={}
 with contextlib.redirect_stdout(io.StringIO()):exec(c['source'],ns)
 torch.testing.assert_close(ns['weights'],weights);torch.testing.assert_close(ns['output'],output)
 sdpa=None
 if s['orientation']=='qk' and s['scale'] and s['axis']==-1 and s['values']=='v':
  sdpa=torch.nn.functional.scaled_dot_product_attention(q/T,k,v,is_causal=s['causal'],dropout_p=0.).tolist()
 results.append({'raw':raw.tolist(),'weights':weights.tolist(),'output':output.tolist(),'sdpa':sdpa})
print(json.dumps(results))`;
const out = JSON.parse(
  execFileSync(process.env.PYTORCH_PYTHON || 'python3', ['-c', python], {
    input: JSON.stringify(cases),
    encoding: 'utf8',
    maxBuffer: 4e7,
    timeout: 120000,
  }),
);
function close(a, b) {
  assert.equal(a.length, b.length);
  a.forEach((row, i) => {
    assert.equal(row.length, b[i].length);
    row.forEach((x, j) => assert.ok(Math.abs(x - b[i][j]) < 1e-9 * Math.max(1, Math.abs(b[i][j]))));
  });
}
let sdpa = 0;
cases.forEach((c, i) => {
  const actual = attention(c.data, c.settings, c.temperature);
  for (const field of ['raw', 'weights', 'output']) close(actual[field], out[i][field]);
  if (out[i].sdpa) {
    close(actual.output, out[i].sdpa);
    sdpa++;
  }
});
console.log(
  `PyTorch conformance: ${cases.length} attention configurations and exported programs; ${sdpa} functional SDPA comparisons passed.`,
);
