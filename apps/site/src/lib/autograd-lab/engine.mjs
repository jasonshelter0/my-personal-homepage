// A bounded scalar autodiff laboratory, not a Python runtime.
const finite = n => { if(!Number.isFinite(n)||Math.abs(n)>1e100) throw Error('numeric'); return n; };
export class Tape {
  constructor(){this.nodes=[];}
  node(value, label='', requiresGrad=false, parents=[], cut=null){
    if(this.nodes.length>=160)throw Error('limit');
    const node={id:this.nodes.length,value:finite(value),label,requiresGrad,parents,cut,grad:null,used:false};
    this.nodes.push(node);return node;
  }
  leaf(value,label,requiresGrad=false){return this.node(value,label,requiresGrad);}
  op(a,b,kind,label=kind){
    const value=kind==='+'?a.value+b.value:kind==='-'?a.value-b.value:kind==='*'?a.value*b.value:a.value/b.value;
    const da=kind==='*'?b.value:kind==='/'?1/b.value:1;
    const db=kind==='*'?a.value:kind==='/'?-a.value/(b.value*b.value):kind==='-'?-1:1;
    return this.node(value,label,a.requiresGrad||b.requiresGrad,[{node:a,local:finite(da)},{node:b,local:finite(db)}]);
  }
  detach(a){return this.node(a.value,'detach',false,[],a);}
  backward(root){
    if(!root.requiresGrad)throw Error('no-gradient');
    const seen=new Set(),order=[];
    const visit=node=>{if(seen.has(node))return;seen.add(node);if(node.requiresGrad){for(const edge of node.parents)if(edge.node.requiresGrad)visit(edge.node);order.push(node);}};
    visit(root);
    if(order.some(n=>n.parents.length&&n.used))throw Error('graph-freed');
    const adjoints=new Map([[root,1]]),events=[{to:root.id,contribution:1,after:1,from:null,local:1,upstream:1}];
    for(const node of order.reverse()) {
      const upstream=adjoints.get(node)||0;
      if(!node.parents.length)node.grad=finite((node.grad??0)+upstream);
      else node.used=true;
      for(const [edgeIndex,{node:parent,local}] of node.parents.entries()){
        if(!parent.requiresGrad)continue;
        const contribution=finite(upstream*local),after=finite((adjoints.get(parent)||0)+contribution);
        adjoints.set(parent,after);events.push({from:node.id,to:parent.id,edgeIndex,local,upstream,contribution,after});
      }
    }
    return {events,adjoints:Object.fromEntries([...adjoints].map(([n,v])=>[n.id,v]))};
  }
}
export const examples=[
  {x:2,w:1,b:0,target:6},
  {x:-1,w:0.5,b:1,target:3},
  {x:3,w:-1,b:2,target:1},
  {x:0.5,w:2,b:-1,target:2},
];
export function graph(example=examples[0],detached=false,buffers={w:null,b:null}) {
  const tape=new Tape(),w=tape.leaf(example.w,'w',true),x=tape.leaf(example.x,'x'),b=tape.leaf(example.b,'b',true),target=tape.leaf(example.target,'target');
  w.grad=buffers.w;b.grad=buffers.b;
  const source=detached?tape.detach(w):w;
  const product=tape.op(source,x,'*','w × x'),prediction=tape.op(product,b,'+','prediction');
  const error=tape.op(prediction,target,'-','error'),loss=tape.op(error,error,'*','loss');
  return {tape,w,b,loss,prediction,error,example,detached};
}
export function expectedGradient(e){return 2*(e.w*e.x+e.b-e.target)*e.x;}
export const dataset=[[-1,-1],[0,1],[1,3],[2,5]];
export const stages=['zero','forward','backward','step'];
export const brokenStages=['zero','forward','step','backward'];
export function lossAt(w,b,data=dataset){return data.reduce((sum,[x,y])=>sum+(w*x+b-y)**2,0)/data.length;}
export function train({order=stages,rate=0.1,steps=12,clear=true,data=dataset}={}) {
  if(!Number.isFinite(rate)||rate<0.001||rate>1||!Number.isInteger(steps)||steps<1||steps>30)throw Error('limit');
  if(order.length!==4||new Set(order).size!==4||order.some(s=>!stages.includes(s)))throw Error('order');
  if(!Array.isArray(data)||!data.length||data.length>8||data.some(p=>p.length!==2||p.some(n=>!Number.isFinite(n)||Math.abs(n)>10)))throw Error('limit');
  let w=0,b=0,wGrad=null,bGrad=null;const history=[{step:0,w,b,loss:lossAt(w,b,data),wGrad,bGrad}],events=[];
  let current=null;
  for(let iteration=0;iteration<steps;iteration++){
    for(const stage of order){
      if(stage==='zero'&&clear){wGrad=bGrad=null;}
      if(stage==='forward'){
        const tape=new Tape(),wn=tape.leaf(w,'w',true),bn=tape.leaf(b,'b',true);
        wn.grad=wGrad;bn.grad=bGrad;
        let loss=tape.leaf(0,'0');
        for(const [x,y] of data){const pred=tape.op(tape.op(wn,tape.leaf(x,'x'),'*'),bn,'+');const error=tape.op(pred,tape.leaf(y,'target'),'-');loss=tape.op(loss,tape.op(error,error,'*'),'+');}
        loss=tape.op(loss,tape.leaf(data.length,'N'),'/');current={tape,wn,bn,loss};
      }
      if(stage==='backward'){
        if(!current)throw Error('forward-first');
        // zero_grad may have occurred since forward; buffers belong to parameters.
        current.wn.grad=wGrad;current.bn.grad=bGrad;
        current.tape.backward(current.loss);wGrad=current.wn.grad;bGrad=current.bn.grad;
      }
      if(stage==='step'){if(wGrad!==null)w=finite(w-rate*wGrad);if(bGrad!==null)b=finite(b-rate*bGrad);}
      events.push({iteration:iteration+1,stage,w,b,wGrad,bGrad});
    }
    history.push({step:iteration+1,w,b,loss:finite(lossAt(w,b,data)),wGrad,bGrad});
  }
  return {history,events,order:[...order],rate,clear};
}
export function trainingPass(options){
  try {return [dataset,[[-2,-3],[-1,-1],[0,1],[1,3]]].every(data=>{const h=train({...options,data}).history;return h.at(-1).loss<h[0].loss*0.02;});} catch{return false;}
}
export function exportGraph(example,detached=false,passes=1,clear=true){
  return `import torch\n\nw = torch.tensor(${example.w}, dtype=torch.float64, requires_grad=True)\nb = torch.tensor(${example.b}, dtype=torch.float64, requires_grad=True)\nx = torch.tensor(${example.x}, dtype=torch.float64)\ntarget = torch.tensor(${example.target}, dtype=torch.float64)\noptimizer = torch.optim.SGD([w, b], lr=0.1)\n\nfor _ in range(${passes}):\n${clear?'    optimizer.zero_grad(set_to_none=True)\n':''}    prediction = ${detached?'w.detach()':'w'} * x + b\n    error = prediction - target\n    loss = error * error\n    loss.backward()\n    print('loss:', loss.item(), 'w.grad:', w.grad, 'b.grad:', b.grad)\n`;
}
export function exportTraining({order=stages,rate=0.1,clear=true}={}){
  const lines={zero:clear?'optimizer.zero_grad(set_to_none=True)':'# Gradients are intentionally not cleared.',forward:'prediction = w * x + b\nloss = ((prediction - target) ** 2).mean()',backward:'loss.backward()',step:'optimizer.step()'};
  return `import torch\n\nx = torch.tensor([-1., 0., 1., 2.], dtype=torch.float64)\ntarget = 2 * x + 1\nw = torch.tensor(0., dtype=torch.float64, requires_grad=True)\nb = torch.tensor(0., dtype=torch.float64, requires_grad=True)\noptimizer = torch.optim.SGD([w, b], lr=${rate})\n\nfor _ in range(12):\n${order.map(s=>lines[s].split('\n').map(l=>'    '+l).join('\n')).join('\n')}\n\nwith torch.no_grad():\n    print('w, b:', w.item(), b.item())\n    print('final MSE:', ((w * x + b - target) ** 2).mean().item())\n`;
}
