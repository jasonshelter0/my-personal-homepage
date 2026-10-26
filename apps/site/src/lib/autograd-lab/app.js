import { examples, graph, expectedGradient, dataset, stages, brokenStages, train, trainingPass, exportGraph, exportTraining } from './engine.mjs';

const NS='http://www.w3.org/2000/svg';
const ids=['chain','detach','accumulation','training'];
const fmt=n=>n===null?'None':Number.isFinite(n)?Number(n.toPrecision(6)).toString():'—';
function el(tag,text,attrs={}) { const node=document.createElement(tag); if(text!==undefined)node.textContent=text; for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));return node; }
function svg(tag,attrs={},text) { const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(text!==undefined)node.textContent=text;return node; }

for(const root of document.querySelectorAll('[data-autograd-lab]')) {
  const t=JSON.parse(root.querySelector('[data-ag-copy]').textContent),u=t.ui;
  const q=name=>root.querySelector(`[data-ag-${name}]`),show=(name,yes)=>q(name).hidden=!yes;
  let mission='chain',exampleIndex=0,current,trace=null,frame=0,passes=0,before={w:null,b:null},buffers={w:null,b:null},selected=0;
  let order=[...brokenStages],training=null,prediction=null,timer=null,lastWidth=0;
  const predicted=new Set();let completed=new Set();
  try {const saved=JSON.parse(localStorage.getItem('learnpytorch-autograd-v1')||'[]');if(Array.isArray(saved))completed=new Set(saved.filter(id=>ids.includes(id)));} catch {show('storage',true);}
  const trainingOptions=()=>({order,rate:Number(q('rate').value)});
  const code=()=>mission==='training'?exportTraining(trainingOptions()):exportGraph(examples[exampleIndex],mission==='detach'&&q('detach').checked,mission==='accumulation'?Math.max(2,passes):1,mission!=='accumulation'||q('clear').checked);
  function updateCode(){q('code').textContent=code();}
  function progress(){q('progress').textContent=`${u.progress} ${completed.size} / 4`;for(const button of root.querySelectorAll('[data-ag-mission]')){button.classList.toggle('is-complete',completed.has(button.dataset.agMission));button.setAttribute('aria-current',button.dataset.agMission===mission?'step':'false');}}
  function feedback(text,kind='info'){q('feedback').textContent=text;q('feedback').dataset.kind=kind;show('success',false);}
  function stop(){if(timer)clearInterval(timer);timer=null;q('play').textContent=mission==='training'?u.playTraining:u.play;}
  const maxFrame=()=>mission==='training'?(training?.history.length||1)-1:trace?.events.length||0;
  function partial(){const values={};if(trace)for(const e of trace.events.slice(0,frame))values[e.to]=e.after;return values;}
  function resetExperiment(){
    stop();trace=null;training=null;frame=passes=0;before={w:null,b:null};buffers={w:null,b:null};prediction=null;
    current=graph(examples[exampleIndex],mission==='detach'&&q('detach').checked);selected=current.w.id;
    q('prediction').value='';q('passes').textContent=`${u.passCount}: 0`;show('hint-text',false);feedback(u.empty);updateCode();render();
  }
  function selectMission(id){mission=id;const m=t.missions[ids.indexOf(id)];q('title').textContent=m.title;q('intro').textContent=m.intro;q('goal').textContent=m.goal;q('transfer').textContent=m.transfer;
    show('graph-controls',id!=='training');show('training-controls',id==='training');show('predict-wrap',id==='chain');show('detach-wrap',id==='detach');show('clear-wrap',id==='accumulation');q('detach').checked=true;q('clear').checked=false;order=[...brokenStages];q('rate').value='0.1';q('backward').textContent=id==='accumulation'?u.anotherPass:u.backward;progress();renderOrder();resetExperiment();
  }
  function renderInspector(values){
    const n=current.tape.nodes[selected],panel=q('inspector');panel.replaceChildren(el('strong',n.label));
    panel.append(el('p',`${u.value}: ${fmt(n.value)} · ${u.derivative}: ${n.requiresGrad?(values[n.id]===undefined?u.notReached:fmt(values[n.id])):u.notTracked}`));
    const events=trace?.events.slice(0,frame).filter(e=>e.to===n.id)||[];
    for(const e of events)panel.append(el('p',e.from===null?`${n.label}: ∂loss/∂loss = 1`:`${current.tape.nodes[e.from].label} → ${n.label}: ${u.incoming} ${fmt(e.upstream)} × ${u.local} ${fmt(e.local)} = ${fmt(e.contribution)}`));
    if(n.cut)panel.append(el('p',u.cutNote));
    if(n===current.w||n===current.b){const key=n===current.w?'w':'b';const stored=values[n.id]===undefined?before[key]:(before[key]??0)+values[n.id];panel.append(el('p',`${u.buffer}: ${fmt(stored)}`));}
  }
  function renderGraph(){
    if(mission==='training'||!current)return;
    const container=q('graph'),focused=document.activeElement?.dataset?.agNode,values=partial();
    const width=Math.max(180,container.clientWidth),boxW=Math.min(154,width-12),boxH=82,cols=Math.max(1,Math.floor(width/(boxW+14))),positions=new Map(),depths=new Map(),layers=[];
    for(const n of current.tape.nodes){const parents=n.cut?[n.cut]:n.parents.map(e=>e.node);const depth=parents.length?Math.max(...parents.map(p=>depths.get(p)))+1:0;depths.set(n,depth);}
    // Put constant inputs next to the operation that first consumes them.
    for(const n of current.tape.nodes){if(!n.parents.length&&!n.cut){const consumers=current.tape.nodes.filter(c=>c.parents.some(e=>e.node===n)||c.cut===n);if(consumers.length)depths.set(n,Math.min(...consumers.map(c=>depths.get(c)))-1);}}
    for(const n of current.tape.nodes)(layers[depths.get(n)]??=[]).push(n);
    let y=14;
    for(const layer of layers){for(let start=0;start<layer.length;start+=cols){const row=layer.slice(start,start+cols),total=row.length*boxW+(row.length-1)*14;row.forEach((n,i)=>positions.set(n,{x:(width-total)/2+i*(boxW+14),y}));y+=boxH+38;}y+=14;}
    const drawing=svg('svg',{viewBox:`0 0 ${width} ${y}`,width,height:y,'aria-hidden':'true',class:'ag-edges'});
    const defs=svg('defs');for(const [id,color] of [['ag-forward','var(--text)'],['ag-backward','var(--accent)']]){const marker=svg('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:color}));defs.append(marker);}drawing.append(defs);
    const active=trace?.events[frame-1];
    for(const n of current.tape.nodes){const pos=positions.get(n),edges=n.cut?[{node:n.cut,cut:true}]:n.parents;
      edges.forEach((edge,index)=>{const source=positions.get(edge.node),offset=edges.length>1?(index-(edges.length-1)/2)*26:0;const ax=source.x+boxW/2+offset,ay=source.y+boxH,bx=pos.x+boxW/2+offset,by=pos.y;
        const isActive=active?.from===n.id&&active?.to===edge.node.id&&active?.edgeIndex===index;
        // Long edges travel in an outside lane instead of crossing an unrelated node.
        const lane=edge.node.id%2===0?6:width-6;
        const path=by-ay>80?`M ${ax} ${ay} L ${ax} ${ay+12} L ${lane} ${ay+12} L ${lane} ${by-14} L ${bx} ${by-14} L ${bx} ${by}`:`M ${ax} ${ay} C ${ax} ${(ay+by)/2}, ${bx} ${(ay+by)/2}, ${bx} ${by}`;
        drawing.append(svg('path',{d:path,fill:'none',class:edge.cut?'ag-edge ag-cut':'ag-edge','marker-end':'url(#ag-forward)'}));
        if(isActive)drawing.append(svg('path',{d:path,fill:'none',class:'ag-edge ag-active','marker-start':'url(#ag-backward)'}));
      });
    }
    container.replaceChildren(drawing);container.style.height=`${y}px`;
    for(const n of current.tape.nodes){const pos=positions.get(n),button=el('button',undefined,{'type':'button','data-ag-node':n.id,'aria-pressed':selected===n.id,'aria-label':`${n.label}, ${u.value}: ${fmt(n.value)}, ${u.derivative}: ${n.requiresGrad?(values[n.id]===undefined?u.notReached:fmt(values[n.id])):u.notTracked}`});button.className=`ag-node${!n.requiresGrad?' ag-untracked':''}${active?.to===n.id?' ag-reached':''}`;Object.assign(button.style,{left:`${pos.x}px`,top:`${pos.y}px`,width:`${boxW}px`,height:`${boxH}px`});button.append(el('strong',n.label),el('span',fmt(n.value)),el('small',n.requiresGrad?`∂loss/∂v: ${values[n.id]===undefined?'…':fmt(values[n.id])}`:u.notTracked));button.addEventListener('click',()=>{selected=n.id;renderGraph();q('graph').querySelector(`[data-ag-node="${n.id}"]`)?.focus({preventScroll:true});});container.append(button);}
    if(focused!==undefined)container.querySelector(`[data-ag-node="${focused}"]`)?.focus({preventScroll:true});
    renderInspector(values);const dl=q('buffers');dl.replaceChildren();for(const key of ['w','b']){const value=values[current[key].id]===undefined?before[key]:(before[key]??0)+values[current[key].id];const group=el('div');group.append(el('dt',`${key}.grad · ${u.buffer}`),el('dd',fmt(value),{[`data-ag-buffer-${key}`]:''}));dl.append(group);}
    show('cut-note',current.detached);
  }
  function plotBase(label){const s=svg('svg',{viewBox:'0 0 360 240',role:'img','aria-label':label});s.append(svg('title',{},label),svg('path',{d:'M 42 18 V 205 H 344',class:'ag-axis',fill:'none'}));return s;}
  function renderTraining(){
    const history=training?.history||[{step:0,w:0,b:0,loss:9,wGrad:null,bGrad:null}],h=history[Math.min(frame,history.length-1)];
    const predictions=dataset.map(([x])=>h.w*x+h.b),allY=[...dataset.map(p=>p[1]),...predictions],lo=Math.min(...allY)-1,hi=Math.max(...allY)+1;
    const xScale=x=>52+(x+1)/3*278,yScale=y=>195-(y-lo)/(hi-lo)*165;
    const fit=plotBase(`${u.actual}: w=${fmt(h.w)}, b=${fmt(h.b)}`);
    for(const y of [lo,hi])fit.append(svg('text',{x:37,y:yScale(y)+4,'text-anchor':'end',class:'ag-tick'},fmt(y)));
    for(const [x,y] of dataset){fit.append(svg('circle',{cx:xScale(x),cy:yScale(y),r:5,class:'ag-point'}),svg('text',{x:xScale(x),y:222,'text-anchor':'middle',class:'ag-tick'},fmt(x)));}
    fit.append(svg('line',{x1:xScale(-1),y1:yScale(-1),x2:xScale(2),y2:yScale(5),class:'ag-target'}),svg('line',{x1:xScale(-1),y1:yScale(predictions[0]),x2:xScale(2),y2:yScale(predictions[3]),class:'ag-model'}));
    q('fit').replaceChildren(el('h4',`${u.actual} / ${u.reference}`),fit,el('p',`${u.actual}: y = ${fmt(h.w)}x + ${fmt(h.b)}; ${u.reference}: y = 2x + 1`));
    const loss=plotBase(`${u.loss}: ${fmt(h.loss)}`),scale=Math.max(1,...history.map(v=>Math.log1p(v.loss))),lx=i=>50+i/12*280,ly=v=>195-Math.log1p(v)/scale*165;
    for(const v of [0,Math.expm1(scale)])loss.append(svg('text',{x:37,y:ly(v)+4,'text-anchor':'end',class:'ag-tick'},fmt(v)));
    loss.append(svg('polyline',{points:history.slice(0,frame+1).map(v=>`${lx(v.step)},${ly(v.loss)}`).join(' '),class:'ag-model',fill:'none'}),svg('circle',{cx:lx(h.step),cy:ly(h.loss),r:5,class:'ag-point'}));
    for(const step of [0,6,12])loss.append(svg('text',{x:lx(step),y:222,'text-anchor':'middle',class:'ag-tick'},String(step)));
    q('loss').replaceChildren(el('h4',`${u.loss} · log(1 + loss)`),loss);
    q('training-metrics').textContent=`${u.epoch} ${h.step} / 12 · ${u.loss}: ${fmt(h.loss)} · w=${fmt(h.w)}, b=${fmt(h.b)}`;
    const table=el('table'),head=el('thead'),row=el('tr');for(const name of [u.epoch,'w','b',u.loss,'w.grad','b.grad'])row.append(el('th',name,{scope:'col'}));head.append(row);table.append(head);const body=el('tbody');for(const v of history){const r=el('tr');for(const k of ['step','w','b','loss','wGrad','bGrad'])r.append(el('td',v[k]===null?'None':String(v[k])));body.append(r);}table.append(body);const dataTable=el('table'),dataHead=el('tr');for(const name of ['x','target'])dataHead.append(el('th',name,{scope:'col'}));dataTable.append(dataHead);for(const point of dataset){const r=el('tr');for(const v of point)r.append(el('td',String(v)));dataTable.append(r);}q('table').replaceChildren(dataTable,table);
  }
  function render(){
    if(mission==='training')renderTraining();else renderGraph();
    const max=maxFrame();q('frame').textContent=`${u.frame} ${frame} / ${max}`;q('prev').disabled=frame===0;q('next').disabled=frame===max;q('all').disabled=frame===max;q('play').disabled=max===0;
    if(mission==='training'){const h=training?.history[frame];q('event').textContent=h?`${u.epoch} ${h.step}: ${u.loss} = ${fmt(h.loss)}`:u.trainPrompt;}
    else {const event=trace?.events[frame-1];q('event').textContent=event?(event.from===null?'∂loss/∂loss = 1':`${current.tape.nodes[event.from].label} → ${current.tape.nodes[event.to].label}: ${fmt(event.upstream)} × ${fmt(event.local)} = ${fmt(event.contribution)}; Σ = ${fmt(event.after)}`):u.empty;}
  }
  function renderOrder(){const list=q('order');list.replaceChildren();order.forEach((stage,index)=>{const li=el('li',undefined,{'data-ag-stage':stage});li.append(el('code',({zero:'optimizer.zero_grad()',forward:'loss = forward()',backward:'loss.backward()',step:'optimizer.step()'})[stage]),el('span',u[stage==='backward'?'backwardStage':stage]));const buttons=el('div');for(const [delta,label] of [[-1,u.up],[1,u.down]]){const b=el('button',delta<0?'↑':'↓',{type:'button','aria-label':`${label}: ${stage}`,'data-ag-move':delta});b.disabled=index+delta<0||index+delta>=order.length;b.addEventListener('click',()=>{[order[index],order[index+delta]]=[order[index+delta],order[index]];stop();training=null;frame=0;feedback(u.trainPrompt);renderOrder();updateCode();render();q('order').querySelector(`[data-ag-stage="${stage}"] [data-ag-move="${delta}"]`)?.focus({preventScroll:true});});buttons.append(b);}li.append(buttons);list.append(li);});}
  function runBackward(){
    stop();if(mission==='chain'&&!trace){const raw=q('prediction').value;prediction=raw.trim()===''?null:Number(raw);if(prediction===null||!Number.isFinite(prediction)){feedback(u.invalid,'error');return;}}
    before=mission==='accumulation'&&!q('clear').checked?{...buffers}:{w:null,b:null};current=graph(examples[exampleIndex],mission==='detach'&&q('detach').checked,before);
    try {trace=current.tape.backward(current.loss);buffers={w:current.w.grad,b:current.b.grad};passes++;frame=0;q('passes').textContent=`${u.passCount}: ${passes}`;feedback(u.completeTrace);updateCode();render();}catch(e){feedback(e.message==='numeric'?u.numericError:u.graphError,'error');}
  }
  function check(){
    if(mission==='training'){if(!training){feedback(u.trainPrompt,'error');return;}if(!trainingPass(trainingOptions())){feedback(u.trainFail,'error');return;}}
    else {
      if(!trace){feedback(u.needBackward,'error');return;}if(frame<maxFrame()){feedback(u.completeTrace,'error');return;}
      if(mission==='chain'){if(Math.abs(prediction-expectedGradient(examples[exampleIndex]))>1e-7){feedback(u.wrongPrediction,'error');return;}predicted.add(exampleIndex);if(predicted.size<2){feedback(u.needTwo,'success');return;}}
      if(mission==='detach'){const good=!q('detach').checked&&examples.every(e=>{const g=graph(e);g.tape.backward(g.loss);return Math.abs(g.w.grad-expectedGradient(e))<1e-9;});if(!good){feedback(u.detachedError,'error');return;}}
      if(mission==='accumulation'&&(passes<2||!q('clear').checked||Math.abs(buffers.w-expectedGradient(examples[exampleIndex]))>1e-9)){feedback(u.accumError,'error');return;}
    }
    completed.add(mission);try{localStorage.setItem('learnpytorch-autograd-v1',JSON.stringify([...completed]));}catch{show('storage',true);}progress();feedback(mission==='training'?u.trainPass:mission==='detach'?u.fixed:u.success,'success');show('success',true);
  }
  root.querySelectorAll('[data-ag-mission]').forEach(b=>b.addEventListener('click',()=>selectMission(b.dataset.agMission)));
  q('reset').addEventListener('click',()=>{if(mission==='training'){order=[...brokenStages];q('rate').value='0.1';renderOrder();}resetExperiment();});
  q('example').addEventListener('change',()=>{exampleIndex=Number(q('example').value);resetExperiment();});
  for(const name of ['detach','clear'])q(name).addEventListener('change',resetExperiment);
  q('rate').addEventListener('input',()=>{stop();training=null;frame=0;feedback(u.trainPrompt);updateCode();render();});
  q('backward').addEventListener('click',runBackward);
  q('train').addEventListener('click',()=>{stop();training=null;frame=0;show('success',false);try{training=train(trainingOptions());feedback(u.traceTraining);render();}catch(e){feedback(e.message==='numeric'||e.message==='limit'?u.numericError:u.graphError,'error');render();}});
  q('prev').addEventListener('click',()=>{stop();frame=Math.max(0,frame-1);render();});q('next').addEventListener('click',()=>{stop();frame=Math.min(maxFrame(),frame+1);render();});q('all').addEventListener('click',()=>{stop();frame=maxFrame();render();});
  q('play').addEventListener('click',()=>{if(timer){stop();return;}if(frame===maxFrame())frame=0;render();q('play').textContent=u.pause;timer=setInterval(()=>{frame=Math.min(maxFrame(),frame+1);render();if(frame===maxFrame())stop();},850);});
  q('check').addEventListener('click',check);q('hint').addEventListener('click',()=>{q('hint-text').textContent=t.missions[ids.indexOf(mission)].hint;show('hint-text',true);});
  q('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([code()],{type:'text/x-python;charset=utf-8'}));const a=el('a',undefined,{href:url,download:`learnpytorch-${mission}.py`});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
  const observer=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)>1){lastWidth=width;renderGraph();}});observer.observe(q('graph'));
  selectMission('chain');
}
