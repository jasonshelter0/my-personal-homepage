import { Tensor, execute, size, binary } from './engine.mjs';
import { lessons, sandbox, validate } from './lessons.mjs';
import { exportPython } from './export.mjs';
import { cellExplanation } from './visual.mjs';

const root = document.querySelector('[data-tensor-lab]');
if (root) init(root);
function init(root) {
  const $ = name => root.querySelector(`[data-${name}]`);
  const t = JSON.parse($('tensor-copy').textContent), u = t.ui;
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number.isInteger(n) ? String(n) : Number(n.toFixed(3)).toString();
  const shape = tensor => `[${tensor.shape.join(', ')}]`;
  const axisName = name => t.axes[name] || name.replace(/^axis /,`${t.axes.axis} `);
  const courses = lessons.map((l,i)=>({...l,...t.lessons[i]}));
  const free = {...sandbox,...t.sandbox};
  const drafts = new Map();
  let timer = null, difference = false, chartRow = 0;
  let current, inputs, trace=[], selected=-1, inputIndex=0, slice=0, target=false, result, hints=0, progress=[], expanded=false, oldOverflow='', savedFocus;
  try { const value=JSON.parse(localStorage.getItem('learnpytorch-progress-v1') || '[]'); if(Array.isArray(value)) progress=[...new Set(value.filter(id=>courses.some(l=>l.id===id)))]; } catch { $('storage-notice').hidden=false; }
  function message(text,kind='info') { $('feedback').textContent=text; $('feedback').dataset.kind=kind; }
  function updateProgress() {
    $('progress').textContent=`${u.progress} ${progress.length} / ${courses.length}`;
    root.querySelectorAll('[data-lesson]').forEach(b=>{ b.setAttribute('aria-current', b.dataset.lesson===current.id?'step':'false'); b.classList.toggle('is-complete',progress.includes(b.dataset.lesson)); });
  }
  function stopPlayback() { clearInterval(timer); timer=null; $('play').textContent=u.play; }
  function choose(id,code) {
    stopPlayback(); difference=false; chartRow=0;
    if(current) drafts.set(current.id,$('editor').value);
    current=courses.find(l=>l.id===id) || (id==='sandbox'?free:courses[0]);
    inputs=current.initial(); trace=[]; selected=-1; inputIndex=0; slice=0; target=false; result=undefined; hints=0;
    for(const key of ['title','intro','goal','concept']) $(key).textContent=current[key];
    $('editor').value=code??drafts.get(current.id)??current.starter;
    $('hint-box').hidden=$('share-box').hidden=$('success').hidden=true;
    $('hint').textContent=u.hint; $('target').hidden=$('difference').hidden=!current.target;
    message(u.ready); updateProgress(); render();
  }
  function errorMessage(error) {
    const s=String(error);
    if(/broadcast/i.test(s)) return t.errors.broadcast;
    if(/Matrix multiplication|supports @/i.test(s)) return t.errors.matmul;
    if(/reshape|inferred/.test(s)) return t.errors.reshape;
    if(/Axis|permute/.test(s)) return t.errors.axis;
    if(/4096|6000|100 operations|1–4 axes/.test(s)) return t.errors.limit;
    if(/finite|rows must|Empty tensors/.test(s)) return t.errors.finite;
    return t.errors.syntax;
  }
  function note(tensor) {
    const s=tensor.note;
    if(/Flatten merges/.test(s)) return t.notes.flatten;
    if(/Softmax normalizes/.test(s)) return t.notes.softmax;
    if(/Axes reordered/.test(s)) return t.notes.permute;
    if(/Logical element/.test(s)) return t.notes.reshape;
    if(/^(A size-one|Size-one axes removed)/.test(s)) return t.notes.singleton;
    if(/Mean|Sum/.test(s)) return t.notes.reduction;
    if(/Inner axes/.test(s)) return t.notes.matmul;
    if(/→/.test(s)) return t.notes.arithmetic;
    return t.notes.new;
  }
  function shown() { if(difference) return binary(result.env.y,current.target(inputs),'-'); return target&&current.target?current.target(inputs):selected>=0?trace[selected].tensor:Object.values(inputs)[inputIndex]; }
  function render() {
    $('result').setAttribute('aria-pressed',String(!target&&!difference)); $('difference').setAttribute('aria-pressed',String(difference)); $('target').setAttribute('aria-pressed',String(target));
    const tensor=shown(), dims=tensor.shape, rank=dims.length, rows=rank>=2?dims.at(-2):1, cols=rank?dims.at(-1):1;
    const batches=rank>2?size(dims.slice(0,-2)):1; slice=Math.max(0,Math.min(slice,batches-1));
    const coords=[]; let rem=slice; for(let i=rank-3;i>=0;i--) {coords[i]=rem%dims[i];rem=Math.floor(rem/dims[i]);}
    const expected=current.target?.(inputs), final=!target&&!difference&&result?.env.y===tensor, compare=final&&JSON.stringify(expected?.shape)===JSON.stringify(dims);
    const names=Object.keys(inputs), title=difference?u.difference:target?u.target:selected<0?`${u.input} ${names[inputIndex]}`:`${u.step} ${selected+1}`;
    const values=tensor.values, max=Math.max(1,...values.map(Math.abs)); let cells='';
    for(let r=0;r<Math.min(rows,8);r++) for(let c=0;c<Math.min(cols,8);c++) {
      const index=rank>=2?[...coords,r,c]:rank?[c]:[], value=tensor.at(index), address=tensor.offset+index.reduce((s,x,i)=>s+x*tensor.strides[i],0);
      const wrong=compare&&Math.abs(value-expected.at(index))>1e-5+1e-5*Math.abs(expected.at(index));
      cells+=`<button type="button" class="tl-cell ${wrong?'tl-mismatch':''} ${value<0?'tl-negative':''}" style="--strength:${15+Math.abs(value)/max*40}%" data-address="${address}" data-coordinates="[${index.join(', ')}]" data-value="${esc(fmt(value))}" aria-label="${esc(u.index)} [${index}], ${esc(u.value)} ${esc(fmt(value))}${wrong?`, ${esc(u.mismatch)}`:''}">${fmt(value)}</button>`;
    }
    $('canvas').innerHTML=`<div class="tl-canvas-title"><strong>${esc(title)}</strong><code>${shape(tensor)}</code></div><div class="tl-axes">${dims.map((d,i)=>`<span>${esc(axisName(tensor.axes[i]))} <b>${d}</b></span>`).join('')||esc(t.axes.scalar)}</div>${batches>1?`<div class="tl-slices"><span>${esc(u.slice)} ${coords.map((c,i)=>`${esc(axisName(tensor.axes[i]))} ${c}`).join(' · ')}</span><button type="button" data-prev aria-label="${esc(u.previous)}" ${slice===0?'disabled':''}>←</button><span>${slice+1}/${batches}</span><button type="button" data-forward aria-label="${esc(u.nextSlice)}" ${slice===batches-1?'disabled':''}>→</button></div>`:''}<div class="tl-matrix" style="--columns:${Math.min(cols,8)}">${cells}</div>${rows>8||cols>8?`<p class="tl-muted">${esc(u.truncated)}</p>`:''}${selected<0&&!target&&names.length>1?`<div class="tl-inputs">${names.map((name,i)=>`<button type="button" data-input="${i}" aria-pressed="${inputIndex===i}">${esc(u.input)} ${esc(name)} ${shape(inputs[name])}</button>`).join('')}</div>`:''}`;
    $('calculation').hidden=true;
    $('difference').disabled=!(result?.env.y instanceof Tensor)||!expected||JSON.stringify(result.env.y.shape)!==JSON.stringify(expected.shape);
    $('difference').title=$('difference').disabled?u.diffUnavailable:u.diffNote;
    $('cell-info').textContent=difference?u.diffNote:compare&&values.some((v,i)=>Math.abs(v-expected.values[i])>1e-5+1e-5*Math.abs(expected.values[i]))?u.mismatch:u.cell;
    const shared=Object.values(inputs).some(x=>x.storage===tensor.storage);
    $('details').innerHTML=[[u.elements,size(dims)],[u.strides,`[${tensor.strides.join(', ')}]`],[u.layout,tensor.contiguous?u.contiguous:u.noncontiguous],[u.storage,target?u.target:shared?u.shared:u.newStorage]].map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('trace').innerHTML=`<button type="button" data-step="-1" aria-pressed="${selected===-1&&!target&&!difference}">${esc(u.input)} <small>${names.join(', ')}</small></button>`+trace.map((s,i)=>`<span aria-hidden="true">→</span><button type="button" data-step="${i}" aria-pressed="${selected===i&&!target&&!difference}"><span>${i+1}. ${esc(s.label)}</span><small>${shape(s.tensor)}</small><small>${esc(s.tensor.axes.map(axisName).join(' · ') || t.axes.scalar)}</small></button>`).join('');
    $('back-step').disabled=!trace.length||selected<0;
    $('forward-step').disabled=!trace.length||selected>=trace.length-1;
    $('play').disabled=!trace.length;
    $('frame').textContent=trace.length?`${selected+1} / ${trace.length}`:'';
    renderDistribution(tensor);
    $('note').textContent=difference?u.diffNote:target?u.targetNote:selected<0?u.initialNote:note(tensor);
  }
  function showCalculation(tensor,coords) {
    const calculation=cellExplanation(tensor,coords), box=$('calculation');
    box.hidden=!calculation;if(!calculation)return;
    const max=Math.max(1,...calculation.terms.map(t=>Math.abs(t.value)));
    box.innerHTML=`<h4>${esc(u.calculation)}</h4><p>${esc(u.multiplyThenSum)}</p>`+
      calculation.terms.map(term=>`<div class="tl-term"><code>${fmt(term.a)} × ${fmt(term.b)}</code><span class="tl-term-track"><span style="width:${Math.abs(term.value)/max*100}%" class="${term.value<0?'tl-term-negative':''}"></span></span><code>${fmt(term.value)}</code></div>`).join('')+
      (calculation.count>12?`<p>${esc(u.termsLimited)} 12 / ${calculation.count}</p>`:'')+
      (calculation.bias!==undefined?`<p>${esc(u.bias)}: ${fmt(calculation.bias)}</p>`:'')+
      `<p><strong>${esc(u.total)}: ${fmt(calculation.total)}</strong></p>`;
  }
  function renderDistribution(tensor) {
    const box=$('distribution'), scores=inputs.scores;
    box.hidden=current.id!=='softmax'||difference||(!target&&tensor!==result?.env.y)||JSON.stringify(tensor.shape)!==JSON.stringify(scores?.shape);
    if(box.hidden)return;
    chartRow=Math.max(0,Math.min(chartRow,tensor.shape[1]-1));
    const values=Array.from({length:tensor.shape[2]},(_,k)=>tensor.at([slice,chartRow,k]));
    const sum=values.reduce((a,b)=>a+b,0), max=Math.max(1,...values.map(Math.abs));
    box.innerHTML=`<h4>${esc(u.distribution)}</h4><label>${esc(t.axes.query)} <select data-query-row>${Array.from({length:tensor.shape[1]},(_,q)=>`<option value="${q}" ${q===chartRow?'selected':''}>${q}</option>`).join('')}</select></label>`+
      values.map((v,k)=>`<div class="tl-probability"><span>${esc(t.axes.key)} ${k}<small>${esc(u.score)} ${fmt(scores.at([slice,chartRow,k]))}</small></span><span class="tl-probability-track"><span style="width:${Math.abs(v)/max*100}%" class="${v<0?'tl-term-negative':''}"></span></span><code>${fmt(v)}</code></div>`).join('')+
      `<p class="${Math.abs(sum-1)<1e-5?'tl-sum-correct':'tl-sum-wrong'}">${esc(u.rowSum)}: <strong data-row-sum>${fmt(sum)}</strong> · ${esc(u.expectedOne)}</p><p>${esc(u.distributionNote)}</p>`;
  }
  $('distribution').addEventListener('change',e=>{if(e.target.matches('[data-query-row]')){chartRow=Number(e.target.value);renderDistribution(shown());$('query-row').focus({preventScroll:true});}});
  function run() {
    stopPlayback(); difference=false; chartRow=0;
    $('success').hidden=true; target=false;slice=0;
    try {
      inputs=current.initial();result=execute($('editor').value,inputs);trace=result.trace;selected=trace.length-1;
      if(!trace.length) {message(u.empty,'error');render();return;}
      if(current.target) {
        const check=validate(current,$('editor').value);
        if(check.ok) {
          message(u.success,'success');if(!progress.includes(current.id))progress.push(current.id);
          try{localStorage.setItem('learnpytorch-progress-v1',JSON.stringify(progress));}catch{$('storage-notice').hidden=false;}
          $('success').hidden=false;$('takeaway').textContent=current.takeaway;$('transfer').textContent=current.transfer;
          $('next').textContent=(current.id===courses.at(-1).id?u.sandbox:u.next)+' →';updateProgress();
        } else message(/fresh input|fresh inputs/.test(check.message)?u.freshError:/Assign/.test(check.message)?u.missing:/Expected y/.test(check.message)?u.shapeError:/shape matches/.test(check.message)?u.valueError:errorMessage(check.message),'error');
      } else message(u.executed,'success');
    } catch(e) {trace=e.trace||[];selected=trace.length-1;result=undefined;message(errorMessage(e.message),'error');}
    render();
  }
  function navigate(id) {
    const hash=`#tensor-${id}`;
    if(location.hash!==hash) history.pushState(null,'',hash);
    choose(id);
  }
  function expand(value) {
    expanded=value;
    if(value) {oldOverflow=document.body.style.overflow;savedFocus=document.activeElement;}
    root.classList.toggle('tl-expanded',value);document.body.style.overflow=value?'hidden':oldOverflow;
    root.setAttribute('role',value?'dialog':'region');
    if(value){root.setAttribute('aria-modal','true');root.setAttribute('aria-label',t.title);}else{root.removeAttribute('aria-modal');}
    $('expand').textContent=value?`${u.close} ✕`:`${u.expand} ↗`;$('expand').setAttribute('aria-expanded',String(value));
    (value?$('expand'):savedFocus||$('expand')).focus({preventScroll:true});
  }
  root.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>navigate(b.dataset.lesson));
  $('expand').onclick=()=>expand(!expanded);
  root.addEventListener('keydown',e=>{if(!expanded)return;if(e.key==='Escape'){e.preventDefault();expand(false);}if(e.key==='Tab'){const focusable=[...root.querySelectorAll('button,textarea,select,a[href],summary')].filter(el=>!el.disabled&&el.getClientRects().length);const i=focusable.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();focusable.at(-1)?.focus();}else if(!e.shiftKey&&i===focusable.length-1){e.preventDefault();focusable[0]?.focus();}}});
  $('run').onclick=run;$('reset').onclick=()=>{drafts.delete(current.id);const id=current.id;current=undefined;choose(id);};
  $('editor').addEventListener('input',()=>{stopPlayback();$('success').hidden=true;message(u.changed);});
  $('editor').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run();}if(e.key==='Tab'){e.preventDefault();const ed=$('editor');ed.setRangeText('    ',ed.selectionStart,ed.selectionEnd,'end');ed.dispatchEvent(new Event('input'));}});
  $('result').onclick=()=>{stopPlayback();difference=false;target=false;slice=0;render();};
  $('target').onclick=()=>{stopPlayback();difference=false;target=true;slice=0;render();};
  $('difference').onclick=()=>{stopPlayback();difference=true;target=false;slice=0;render();};
  function moveStep(next) { difference=false;target=false;slice=0;selected=Math.max(-1,Math.min(next,trace.length-1));render(); }
  $('back-step').onclick=()=>{stopPlayback();moveStep(selected-1);};
  $('forward-step').onclick=()=>{stopPlayback();moveStep(selected+1);};
  $('play').onclick=()=>{
    if(timer){stopPlayback();return;}
    if(!trace.length)return;
    if(selected>=trace.length-1)moveStep(-1);
    difference=false;target=false;$('play').textContent=u.pause;render();
    timer=setInterval(()=>{moveStep(selected+1);if(selected===trace.length-1)stopPlayback();},1200);
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
  window.addEventListener('pagehide',stopPlayback);
  $('trace').onclick=e=>{const b=e.target.closest('[data-step]');if(b){stopPlayback();difference=false;selected=Number(b.dataset.step);target=false;slice=0;render();}};
  $('canvas').onclick=e=>{
    if(e.target.closest('[data-prev]')){slice--;render();}else if(e.target.closest('[data-forward]')){slice++;render();}
    const input=e.target.closest('[data-input]');if(input){inputIndex=Number(input.dataset.input);slice=0;render();}
    const cell=e.target.closest('[data-address]');if(cell){stopPlayback();showCalculation(shown(),JSON.parse(cell.dataset.coordinates));$('cell-info').textContent=`${u.index} ${cell.dataset.coordinates} → ${u.value} ${cell.dataset.value} · ${u.offset} ${cell.dataset.address}`;}
  };
  $('hint').onclick=()=>{hints=Math.min(hints+1,current.hints.length);$('hint').textContent=`${u.hint} ${hints}/${current.hints.length}`;$('hint-box').hidden=false;$('hint-box').textContent=current.hints[hints-1];};
  $('next').onclick=()=>navigate(current.id===courses.at(-1).id?'sandbox':courses[courses.indexOf(current)+1].id);
  $('export').onclick=()=>{
    const source=exportPython(current,$('editor').value),url=URL.createObjectURL(new Blob([source],{type:'text/x-python'}));
    const a=document.createElement('a');a.href=url;a.download=`learnpytorch-${current.id}.py`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message(u.exported);
  };
  $('share').onclick=async()=>{
    const code=$('editor').value;if(code.length>6000){message(t.errors.limit,'error');return;}
    const data=btoa(String.fromCharCode(...new TextEncoder().encode(code))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const url=`${location.origin}${location.pathname}#tensor-${current.id}?code=${data}`;
    try{await navigator.clipboard.writeText(url);message(u.copied);}catch{$('share-box').hidden=false;$('share-url').value=url;$('share-url').select();}
  };
  function loadHash() {
    const [id,query]=location.hash.replace(/^#tensor-/,'').split('?');let code;
    try {const data=new URLSearchParams(query).get('code');if(data){if(data.length>32000)throw Error();code=new TextDecoder().decode(Uint8Array.from(atob(data.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));if(code.length>6000)throw Error();}}
    catch{choose(id);message(u.invalidLink,'error');return;}
    choose(id,code);
  }
  window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#tensor-'))loadHash();});loadHash();
}
