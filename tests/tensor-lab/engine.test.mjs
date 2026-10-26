import test from 'node:test';
import assert from 'node:assert/strict';
import {Tensor, fromNested, binary, matmul, execute, equal, broadcastShape} from '../../apps/site/src/lib/tensor-lab/engine.mjs';
import {lessons, validate, sandbox} from '../../apps/site/src/lib/tensor-lab/lessons.mjs';
import {exportPython} from '../../apps/site/src/lib/tensor-lab/export.mjs';
const run = code => execute(code, {}).env.y;
test('permute preserves element identity and shares storage', () => {
  const x = new Tensor(Array.from({length:12},(_,i)=>i),[2,3,2]);
  const y=x.permute(2,0,1);
  assert.deepEqual(y.shape,[2,2,3]); assert.deepEqual(y.values,[0,2,4,6,8,10,1,3,5,7,9,11]);
  assert.equal(y.storage,x.storage); assert.deepEqual(y.strides,[1,6,2]); assert.equal(y.contiguous,false);
  assert.equal(equal(y,x.reshape(2,2,3)),false);
});
test('reshape infers one dimension and preserves logical order',()=>{
  const x=fromNested([[1,2,3],[4,5,6]]);
  assert.deepEqual(x.reshape(-1).values,[1,2,3,4,5,6]);assert.equal(x.reshape(3,2).storage,x.storage);
  assert.deepEqual(x.transpose(0,1).reshape(6).values,[1,4,2,5,3,6]);
  assert.throws(()=>x.reshape(-1,-1));assert.throws(()=>x.reshape(4,2));assert.throws(()=>x.permute(0,0));
});
test('reductions retain the right axis and broadcast correctly',()=>{
  const x=fromNested([[1,2,6],[4,8,9]]),mean=x.reduce(1,true,true);
  assert.deepEqual(mean.shape,[2,1]); assert.deepEqual(mean.values,[3,7]);
  assert.deepEqual(binary(x,mean,'-').values,[-2,-1,3,-3,1,2]);
  assert.throws(()=>binary(x,x.reduce(1,false,true),'-'),/Cannot broadcast/);
  assert.deepEqual(x.reduce(0,false,false).values,[5,10,15]);
  assert.deepEqual(x.reduce(undefined,false,false).values,[30]);
});
test('broadcasting aligns trailing axes, including scalars',()=>{
  assert.deepEqual(broadcastShape([2,1,3],[4,1]),[2,4,3]);
  assert.deepEqual(binary(fromNested([[1],[2]]),fromNested([10,20,30]),'+').values,[11,21,31,12,22,32]);
  assert.deepEqual(binary(fromNested([2,4]),2,'/').values,[1,2]);
  assert.throws(()=>binary(fromNested([1]),0,'/'),/non-finite/);
});
test('matrix and batch products compute actual dot products',()=>{
  assert.deepEqual(matmul(fromNested([[1,2],[3,4]]),fromNested([[5,6],[7,8]])).values,[19,22,43,50]);
  const q=fromNested([[[1,0],[0,1]],[[2,0],[0,3]]]), k=fromNested([[1,2],[3,4]]);
  const y=matmul(q,k);assert.deepEqual(y.shape,[2,2,2]);assert.deepEqual(y.values,[1,2,3,4,2,4,9,12]);
});
test('singleton axes, negative dimensions, and scalar tensors',()=>{
  const x=fromNested([1,2,3]);assert.deepEqual(x.unsqueeze(-1).shape,[3,1]);
  assert.deepEqual(x.unsqueeze(0).squeeze().values,x.values);
  assert.deepEqual(fromNested([[5]]).squeeze().shape,[]);
  assert.deepEqual(x.squeeze(0).shape,[3]);
  assert.throws(()=>x.unsqueeze(3),/out of range/);
});
test('interpreter supports precedence, comments, named args, and trace',()=>{
  const r=execute('x = torch.arange(6).reshape(2, 3)\n# center\nmeans = x.mean(dim=1, keepdim=True)\ny = (x - means) * 2 + 1',{});
  assert.deepEqual(r.env.y.values,[-1,1,3,-1,1,3]);assert.equal(r.trace.length,6);
  assert.deepEqual(run('y = torch.ones(2, 3) * 2 + 3').values,[5,5,5,5,5,5]);
  assert.deepEqual(run('y = torch.tensor([[1, 2], [3, 4]]).transpose(-2, -1)').values,[1,3,2,4]);
});
test('rejects unsupported syntax and bounds resource use',()=>{
  for (const code of ['import os','y = eval(1)','y = torch.ones(99999)','y = torch.ones(2).constructor()','__proto__ = torch.ones(1)','y = torch.tensor([[1], [2,3]])','y = torch.ones(2).mean(dim=0, keepdim=7)','y = torch.arange(6).reshape(2.5,2.4)','y = torch.ones(1); alert(1)']) assert.throws(()=>execute(code,{}),undefined,code);
  assert.throws(()=>execute('x'.repeat(6001),{}));
});
test('partial trace is retained when later operations fail',()=>{
  try {execute('x = torch.ones(2,3)\ny = x @ x',{});assert.fail('Should fail');} catch(e) {assert.match(e.message,/Line 2/);assert.equal(e.trace.length,1);}
});
test('Python export preserves floating semantics for constructors and comments',()=>{
  const code=exportPython(sandbox,'x = torch.arange(12).reshape(3, 4) # example\ny = x.mean(dim=1)');
  assert.match(code,/torch.arange\(12\).to\(torch.float64\).reshape\(3, 4\) # example/);
  assert.match(exportPython(sandbox,'y = torch.ones(2, (3 + 1))'),/torch.ones\(2, \(3 \+ 1\)\).to\(torch.float64\)/);
  assert.match(exportPython(sandbox,'x.transpose(0, 1)'),/_lab_output = x.transpose\(0, 1\)/);
  assert.match(exportPython(sandbox,'z = x.mean()'),/print\(z\)/);
});
test('all lessons accept references, reject starters and hard-coded answers',()=>{
  for (const l of lessons) {
    assert.equal(validate(l,l.solution).ok,true,l.id);
    assert.equal(validate(l,l.starter).ok,false,l.id);
    const t=l.target(l.initial());
    const hardcoded=`y = torch.tensor([${t.values.join(',')}]).reshape(${t.shape.join(',')})`;
    assert.equal(validate(l,hardcoded).ok,false,l.id);
  }
  assert.equal(validate(lessons[1],'means = x.mean(dim=1).unsqueeze(1)\ny = x - means').ok,true);
  assert.equal(validate(lessons[0],'y = x.transpose(0, 2).transpose(1, 2)').ok,true);
  assert.ok(execute(sandbox.starter,sandbox.initial()).env.y);
});
