// Optional independent oracle: PYTORCH_PYTHON=/path/to/python node tests/autograd-lab/compare-pytorch.mjs
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {examples,graph,train,stages,brokenStages,exportGraph,exportTraining} from '../../apps/site/src/lib/autograd-lab/engine.mjs';
const graphCases=[];
for(const example of examples)for(const detached of [false,true])for(const clear of [false,true])graphCases.push({example,detached,clear});
function permutations(a){return a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>i!==j)).map(p=>[v,...p])):[[]];}
const trainingCases=permutations(stages).map(order=>({order,rate:.1,clear:true}));
for(const rate of [.001,.3,1])for(const clear of [true,false])trainingCases.push({order:stages,rate,clear});
const python=`import torch,json,sys,contextlib,io
payload=json.load(sys.stdin)
def scalar(x): return None if x is None else x.item()
def tensor(x,req=False):return torch.tensor(x,dtype=torch.float64,requires_grad=req)
results={'graphs':[],'training':[],'exports':[]}
for case in payload['graphs']:
 e=case['example'];w=tensor(e['w'],True);b=tensor(e['b'],True);x=tensor(e['x']);target=tensor(e['target']);passes=[]
 for _ in range(2):
  if case['clear']:w.grad=None;b.grad=None
  product=(w.detach() if case['detached'] else w)*x;pred=product+b;error=pred-target;loss=error*error
  for n in [product,pred,error,loss]:
   if n.requires_grad:n.retain_grad()
  loss.backward();passes.append({'w':scalar(w.grad),'b':scalar(b.grad),'value':loss.item(),'adjoints':[scalar(n.grad) for n in [product,pred,error,loss]]})
 results['graphs'].append(passes)
for case in payload['training']:
 w=tensor(0.,True);b=tensor(0.,True);x=tensor([-1.,0.,1.,2.]);target=2*x+1;opt=torch.optim.SGD([w,b],lr=case['rate']);history=[];loss=None
 try:
  for _ in range(12):
   for stage in case['order']:
    if stage=='zero' and case['clear']:opt.zero_grad(set_to_none=True)
    if stage=='forward':loss=((w*x+b-target)**2).mean()
    if stage=='backward':loss.backward()
    if stage=='step':opt.step()
   with torch.no_grad():history.append({'w':w.item(),'b':b.item(),'loss':((w*x+b-target)**2).mean().item(),'wGrad':scalar(w.grad),'bGrad':scalar(b.grad)})
  results['training'].append(history)
 except (RuntimeError,AttributeError):results['training'].append('error')
for source in payload['exports']:
 try:
  namespace={}
  with contextlib.redirect_stdout(io.StringIO()):exec(source,namespace)
  results['exports'].append('ok')
 except (RuntimeError,AttributeError):results['exports'].append('error')
print(json.dumps(results))`;
const exports=[...graphCases.map(c=>exportGraph(c.example,c.detached,2,c.clear)),exportTraining(),exportTraining({order:brokenStages}),exportTraining({rate:1})];
const result=JSON.parse(execFileSync(process.env.PYTORCH_PYTHON||'python3',['-c',python],{input:JSON.stringify({graphs:graphCases,training:trainingCases,exports}),encoding:'utf8',maxBuffer:1e7}));
const close=(a,b)=>{if(a===null||b===null)assert.equal(a,b);else assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);};
for(const [i,c] of graphCases.entries()){let buffers={w:null,b:null};for(let pass=0;pass<2;pass++){const g=graph(c.example,c.detached,c.clear?undefined:buffers),r=g.tape.backward(g.loss),expected=result.graphs[i][pass];close(g.loss.value,expected.value);close(g.w.grad,expected.w);close(g.b.grad,expected.b);const nodes=[g.prediction.parents[0].node,g.prediction,g.error,g.loss];nodes.forEach((n,j)=>close(r.adjoints[n.id]??null,expected.adjoints[j]));buffers={w:g.w.grad,b:g.b.grad};}}
for(const [i,c] of trainingCases.entries()){let actual;try{actual=train(c).history.slice(1);}catch{actual='error';}const expected=result.training[i];if(actual==='error'||expected==='error')assert.equal(actual,expected,JSON.stringify(c));else actual.forEach((h,j)=>{for(const k of ['w','b','loss','wGrad','bGrad'])close(h[k],expected[j][k]);});}
assert.ok(result.exports.every(x=>x==='ok'));
console.log(`PyTorch conformance: ${graphCases.length*2} graph/backward passes, ${trainingCases.length} training cases (all 24 stage orders), ${exports.length} runnable exports passed.`);
