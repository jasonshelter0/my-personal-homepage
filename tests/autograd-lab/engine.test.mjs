import test from 'node:test';
import assert from 'node:assert/strict';
import {Tape,examples,graph,expectedGradient,train,trainingPass,stages,brokenStages,exportGraph,exportTraining} from '../../apps/site/src/lib/autograd-lab/engine.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('four graph examples match analytic parameter gradients and local edge contributions',()=>{
 for(const e of examples){const g=graph(e),r=g.tape.backward(g.loss),error=e.w*e.x+e.b-e.target;
  close(g.w.grad,2*error*e.x);close(g.b.grad,2*error);close(r.adjoints[g.error.id],2*error);close(r.adjoints[g.loss.id],1);
  const seen={};for(const event of r.events){close(event.contribution,event.local*event.upstream);seen[event.to]=(seen[event.to]||0)+event.contribution;close(seen[event.to],event.after);}
  assert.deepEqual(seen,r.adjoints);assert.equal(r.events.filter(x=>x.from===g.loss.id).length,2);assert.deepEqual(r.events.filter(x=>x.from===g.loss.id).map(e=>e.edgeIndex),[0,1]);
  assert.equal(g.error.grad,null);assert.equal(g.loss.grad,null);
 }
});
test('detach preserves the forward value, cuts w gradient and allows b backward',()=>{
 for(const e of examples){const original=graph(e),cut=graph(e,true);cut.tape.backward(cut.loss);close(original.loss.value,cut.loss.value);assert.equal(cut.w.grad,null);close(cut.b.grad,2*(e.w*e.x+e.b-e.target));}
});
test('fresh graphs accumulate buffers and clearing keeps a single derivative',()=>{
 const e=examples[0],first=graph(e);first.tape.backward(first.loss);const second=graph(e,false,{w:first.w.grad,b:first.b.grad}),r=second.tape.backward(second.loss);
 close(r.adjoints[second.w.id],expectedGradient(e));close(second.w.grad,2*expectedGradient(e));const cleared=graph(e);cleared.tape.backward(cleared.loss);close(cleared.w.grad,expectedGradient(e));
 assert.throws(()=>first.tape.backward(first.loss),/graph-freed/);
});
test('shared nodes sum all downstream paths before propagating upstream',()=>{
 const t=new Tape(),x=t.leaf(3,'x',true),twice=t.op(x,x,'+'),square=t.op(twice,twice,'*'),y=t.op(square,twice,'+');const r=t.backward(y);close(x.grad,26);close(r.adjoints[twice.id],13);
});
test('division and subtraction derivatives including shared leaves',()=>{
 const t=new Tape(),x=t.leaf(3,'x',true),y=t.leaf(2,'y',true),out=t.op(t.op(x,y,'/'),t.op(y,x,'/'),'-');t.backward(out);close(x.grad,1/2+2/9);close(y.grad,-3/4-1/3);
});
test('untracked roots and numerical limits fail explicitly',()=>{
 const t=new Tape(),x=t.leaf(2);assert.throws(()=>t.backward(x),/no-gradient/);assert.throws(()=>t.leaf(Infinity),/numeric/);assert.throws(()=>t.op(x,t.leaf(0),'/'),/numeric/);for(let i=t.nodes.length;i<160;i++)t.leaf(i);assert.throws(()=>t.leaf(1),/limit/);
});
test('SGD trajectories match independent analytic batch gradients',()=>{
 for(const rate of [.001,.1,.5,1]){const {history}=train({rate});let w=0,b=0;const data=[[-1,-1],[0,1],[1,3],[2,5]];
 for(let i=1;i<history.length;i++){const dw=data.reduce((s,[x,y])=>s+2*(w*x+b-y)*x,0)/4,db=data.reduce((s,[x,y])=>s+2*(w*x+b-y),0)/4;w-=rate*dw;b-=rate*db;close(history[i].w,w);close(history[i].b,b);}
 }
 assert.equal(trainingPass({}),true);assert.equal(trainingPass({order:brokenStages}),false);assert.equal(trainingPass({rate:.001}),false);assert.equal(trainingPass({rate:1}),false);
});
test('wrong update order and clearing after backward prevent learning',()=>{
 for(const order of [brokenStages,['forward','backward','zero','step']]){const h=train({order}).history;assert.ok(h.every(v=>v.w===0&&v.b===0&&v.loss===9));}
 assert.throws(()=>train({order:['backward','forward','zero','step']}),/forward-first/);
 assert.notDeepEqual(train({clear:false}).history,train().history);
});
test('training validates untrusted control bounds',()=>{
 for(const options of [{rate:NaN},{rate:0},{rate:1.1},{steps:0},{steps:31},{order:['zero','zero','backward','step']},{data:[]},{data:[[11,0]]}])assert.throws(()=>train(options));
});
test('Python exports preserve selected detach, clear, rate and order',()=>{
 assert.match(exportGraph(examples[1],true,2,false),/w.detach\(\)/);assert.doesNotMatch(exportGraph(examples[1],true,2,false),/zero_grad/);assert.match(exportGraph(examples[1],false,2,true),/range\(2\)/);
 const s=exportTraining({order:brokenStages,rate:.2});assert.ok(s.indexOf('optimizer.step()')<s.indexOf('loss.backward()'));assert.match(s,/lr=0.2/);assert.deepEqual(stages,['zero','forward','backward','step']);
});
