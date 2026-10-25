import { learningUI, formatLearning } from './learning-ui.js';

const lessonIds = ['foundations', 'mamba', 'vmamba', 'tent', 'cotta', 'frontier', 'ttt', 'irstd', 'lab'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entropy = p => p <= 0 || p >= 1 ? 0 : -p * Math.log(p) - (1-p) * Math.log(1-p);
let widgetSerial = 0;

export function initializeLearning(root) {
  if (root.dataset.learningReady === 'true') return;
  root.dataset.learningReady = 'true';
  const locale = Object.hasOwn(learningUI, root.dataset.locale) ? root.dataset.locale : 'en';
  const t = learningUI[locale];
  const tr = (key, values) => formatLearning(t[key], values);
  const $ = (selector, context = root) => context.querySelector(selector);
  const $$ = (selector, context = root) => [...context.querySelectorAll(selector)];
  const lesson = root.dataset.lesson || 'index';
  const format = (value, digits = 3) => new Intl.NumberFormat(locale, {minimumFractionDigits:digits, maximumFractionDigits:digits}).format(value);
  const storage = {
    get(key) {try {return localStorage.getItem(`jasonshelter:learning:mamba-tta-irstd:${key}`);} catch {return null;}},
    set(key, value) {try {localStorage.setItem(`jasonshelter:learning:mamba-tta-irstd:${key}`, value);return true;} catch {return false;}}
  };
  function updateProgress() {
    const complete = lessonIds.filter(id => storage.get(`done:${id}`) === '1');
    $$('.progress-label').forEach(el => el.textContent = tr('progress', {n:complete.length,total:lessonIds.length}));
    $$('.progress-bar').forEach(el => {el.style.width=`${complete.length/lessonIds.length*100}%`;el.setAttribute('role','progressbar');el.setAttribute('aria-label',t.progressLabel);el.setAttribute('aria-valuemin','0');el.setAttribute('aria-valuemax',String(lessonIds.length));el.setAttribute('aria-valuenow',String(complete.length));});
    $$('[data-chapter]').forEach(el => el.classList.toggle('is-complete',complete.includes(el.dataset.chapter)));
    $$('.mark-complete').forEach(el => {const done=storage.get(`done:${el.dataset.id || lesson}`)==='1';el.textContent=done?t.completed:t.complete;el.classList.toggle('is-complete',done);el.setAttribute('aria-pressed',String(done));});
  }
  $$('.mark-complete').forEach(el => el.addEventListener('click', () => {
    const key=`done:${el.dataset.id || lesson}`;
    const saved=storage.set(key,storage.get(key)==='1'?'0':'1');updateProgress();
    let status=el.parentElement.querySelector('.progress-status');
    if(!status){status=document.createElement('p');status.className='progress-status';status.setAttribute('aria-live','polite');el.after(status);}
    status.textContent=saved?t.saved:t.saveFailed;
  }));updateProgress();
  $$('textarea[data-note]').forEach((el,index) => {
    const key=`note:${locale}:${lesson}:${el.dataset.note || index}`;el.value=storage.get(key)||'';
    let status=el.parentElement.querySelector('.note-status');
    if(!status){status=document.createElement('p');status.className='note-status';el.after(status);}
    status.setAttribute('aria-live','polite');status.textContent=t.localOnly;
    el.addEventListener('input',()=>status.textContent=storage.set(key,el.value)?t.noteSaved:t.noteFailed);
  });
  $$('.quiz').forEach((quiz,index) => {
    const result=$('.quiz-result',quiz);if(result)result.setAttribute('aria-live','polite');
    $$('input[type=radio]',quiz).forEach(input=>{input.name=`learning-${lesson}-quiz-${index}`;});
    $('.quiz-check',quiz)?.addEventListener('click',()=>{
      if(!result)return;const chosen=$('input:checked',quiz);
      if(!chosen){result.className='quiz-result';result.textContent=t.choose;return;}
      const correct=chosen.value===quiz.dataset.answer;
      result.className=`quiz-result ${correct?'correct':'incorrect'}`;
      result.textContent=(correct?t.correct:t.incorrect)+(quiz.dataset.explanation || (correct?t.correctFallback:t.incorrectFallback));
    });
  });

  const colors={main:'var(--accent)',ink:'var(--strong)',secondary:'#fbad80',grid:'var(--line)',muted:'var(--muted)',visited:'color-mix(in srgb, var(--accent) 25%, var(--background))'};
  function range(id,name,label,min,max,step,value){return `<div class="demo-control"><label for="${id}-${name}">${esc(label)}<output id="${id}-${name}-value"></output></label><input id="${id}-${name}" data-control="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;}
  function select(id,name,label,options){return `<div class="demo-control"><label for="${id}-${name}">${esc(label)}</label><select id="${id}-${name}" data-control="${name}">${options.map(([value,text],i)=>`<option value="${value}"${i===0?' selected':''}>${esc(text)}</option>`).join('')}</select></div>`;}
  function shell(el,title,description,controls,content,note){const id=`learning-demo-${++widgetSerial}`;el.innerHTML=`<div class="demo-heading"><h3 id="${id}-title">${esc(title)}</h3><span class="demo-badge">${esc(t.demo)}</span></div><p class="demo-description">${esc(description)}</p><div class="demo-controls">${controls(id)}</div>${content}<p class="demo-footnote">${esc(note)}</p>`;el.setAttribute('role','region');el.setAttribute('aria-labelledby',`${id}-title`);return id;}
  function out(el,id,name,text){$(`#${id}-${name}-value`,el).textContent=text;}
  function num(el,name){return Number($(`[data-control="${name}"]`,el).value);}
  function bind(el,update){$$('input,select',el).forEach(input=>input.addEventListener('input',update));update();}
  function metric(label,value){return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;}
  function legend(entries){return `<div class="chart-legend">${entries.map(([color,label])=>`<span><i style="background:${color}" aria-hidden="true"></i>${esc(label)}</span>`).join('')}</div>`;}
  function chart(series,{title=t.chart,ymax=1,xlabel=t.position,marks=[]}={}){
    const W=600,H=235,L=48,R=18,T=20,B=42,n=Math.max(...series.map(s=>s.values.length));
    const x=i=>L+i/(n-1)*(W-L-R),y=v=>H-B-v/ymax*(H-T-B);let body='';
    for(let j=0;j<5;j++){const v=ymax*j/4;body+=`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="${colors.grid}"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${esc(format(v,2))}</text>`;}
    for(let j=0;j<=4;j++){const i=Math.round((n-1)*j/4);body+=`<text x="${x(i)}" y="${H-23}" text-anchor="middle">${i}</text>`;}
    series.forEach(s=>body+=`<polyline fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dash?'stroke-dasharray="5 4"':''} points="${s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"/>`);
    marks.forEach(m=>body+=`<circle cx="${x(m.x)}" cy="${y(m.y)}" r="5" fill="${colors.secondary}" stroke="var(--background)" stroke-width="2"/>`);
    return `<svg class="chart" role="img" aria-label="${esc(title)}" viewBox="0 0 ${W} ${H}"><title>${esc(title)}</title>${body}<text x="${W-R}" y="${H-4}" text-anchor="end">${esc(xlabel)}</text></svg>`;
  }
  const plot='<div class="plot"></div>',result='<div class="demo-result" aria-live="polite"></div>',metrics='<div class="metrics"></div>';
  const demos={
    ssm(el){const id=shell(el,t.ssmTitle,t.ssmDescription,id=>range(id,'a',t.ssmMemory,0,.99,.01,.8),plot+legend([[colors.secondary,t.input],[colors.main,t.state]])+result,t.ssmNote);bind(el,()=>{const a=num(el,'a'),xs=Array.from({length:36},(_,i)=>i===5?1:0);let h=0;const states=xs.map(x=>h=a*h+(1-a)*x);out(el,id,'a',format(a,2));$('.plot',el).innerHTML=chart([{values:xs,color:colors.secondary,dash:true},{values:states,color:colors.main}],{title:t.ssmTitle});$('.demo-result',el).textContent=tr('ssmResult',{peak:format(1-a),tail:format((1-a)*a**10)})+' '+(a>.7?t.ssmLong:t.ssmShort);});},
    scan(el){const id=shell(el,t.scanTitle,t.scanDescription,id=>select(id,'direction',t.scanDirection,[['row',t.scanRow],['row-reverse',t.scanRowReverse],['column',t.scanColumn],['column-reverse',t.scanColumnReverse]])+range(id,'step',t.scanStep,1,25,1,12),'<div class="scan-layout">'+plot+'<div class="scan-detail" aria-live="polite"></div></div>',t.scanNote);bind(el,()=>{const direction=$('[data-control="direction"]',el).value,step=num(el,'step');let order=Array.from({length:25},(_,i)=>direction.startsWith('column')?[i%5,Math.floor(i/5)]:[Math.floor(i/5),i%5]);if(direction.endsWith('reverse'))order.reverse();const [row,column]=order[step-1],cell=tr('scanCell',{row:row+1,column:column+1});out(el,id,'step',`${step} / 25`);let cells='';order.forEach(([r,c],i)=>{const active=i===step-1;cells+=`<rect x="${15+c*53}" y="${15+r*53}" width="47" height="47" rx="5" fill="${active?colors.secondary:i<step?colors.visited:'var(--background)'}" stroke="${colors.grid}"/><text x="${38.5+c*53}" y="${44+r*53}" text-anchor="middle" style="fill:${active?'#142033':colors.ink}">${i+1}</text>`;});$('.plot',el).innerHTML=`<svg class="chart" role="img" aria-label="${esc(t.scanChart+': '+cell)}" viewBox="0 0 290 290"><title>${esc(t.scanChart)}</title>${cells}<polyline points="${order.slice(0,step).map(([r,c])=>`${38.5+c*53},${38.5+r*53}`).join(' ')}" stroke="${colors.main}" opacity=".3" stroke-width="2" fill="none"/></svg>`;$('.scan-detail',el).innerHTML=`<strong>${esc(cell)}</strong><p>${esc(tr('scanDetail',{step,row:row+1,column:column+1}))}</p>`;});},
    entropy(el){const id=shell(el,t.entropyTitle,t.entropyDescription,id=>range(id,'p',t.probability,.001,.999,.001,.3),plot+metrics+result,t.entropyNote);bind(el,()=>{const p=num(el,'p'),h=entropy(p),g=p*(1-p)*Math.log((1-p)/p);out(el,id,'p',format(p));$('.plot',el).innerHTML=chart([{values:Array.from({length:101},(_,i)=>entropy(i/100)),color:colors.main}],{title:t.entropyTitle,ymax:.75,xlabel:t.entropyAxis,marks:[{x:p*100,y:h}]});$('.metrics',el).innerHTML=metric(t.entropy,format(h))+metric(t.gradient,format(g))+metric(t.direction,Math.abs(p-.5)<.0001?t.noChange:p<.5?t.lower:t.higher);$('.demo-result',el).textContent=Math.abs(p-.5)<.0001?t.entropyHalf:p<.5?t.entropyLow:t.entropyHigh;});},
    teacher(el){const id=shell(el,t.teacherTitle,t.teacherDescription,id=>range(id,'alpha',t.alpha,0,.999,.001,.95)+range(id,'steps',t.steps,1,100,1,20),plot+legend([[colors.secondary,t.student],[colors.main,t.teacher]])+result,t.teacherNote);bind(el,()=>{const a=num(el,'alpha'),k=num(el,'steps');out(el,id,'alpha',format(a));out(el,id,'steps',String(k));const teacher=Array.from({length:101},(_,i)=>1-a**i),student=Array.from({length:101},(_,i)=>i===0?0:1);$('.plot',el).innerHTML=chart([{values:student,color:colors.secondary,dash:true},{values:teacher,color:colors.main}],{title:t.teacherTitle,marks:[{x:k,y:teacher[k]}]});$('.demo-result',el).textContent=tr('teacherResult',{k,state:format(1-a**k),retention:format(a**k*100,1)});});},
    imbalance(el){const id=shell(el,t.imbalanceTitle,t.imbalanceDescription,id=>range(id,'count',t.foregroundCount,1,100,1,10)+range(id,'bg',t.backgroundProbability,.001,.999,.001,.01)+range(id,'fg',t.foregroundProbability,.001,.999,.001,.6),metrics+result,t.imbalanceNote);bind(el,()=>{const n=num(el,'count'),bg=num(el,'bg'),fg=num(el,'fg'),hb=entropy(bg),hf=entropy(fg),total=(10000-n)*hb+n*hf;out(el,id,'count',String(n));out(el,id,'bg',format(bg));out(el,id,'fg',format(fg));$('.metrics',el).innerHTML=metric(t.meanEntropy,format(total/10000,4))+metric(t.balancedEntropy,format((hb+hf)/2,4))+metric(t.foregroundShare,format(n*hf/Math.max(1e-12,total)*100,2)+'%');$('.demo-result',el).textContent=tr('imbalanceRatio',{ratio:format(n/100,2)})+' '+(fg<.5?t.foregroundMissed:t.foregroundKept)+' '+(bg<.5&&fg<.5?t.allBackground:t.tryCollapse);});},
    protocol(el){shell(el,t.protocolTitle,t.protocolDescription,id=>select(id,'mode',t.protocolMode,[['episodic',t.episodic],['continual',t.continual]])+select(id,'unit',t.testUnit,[['image',t.image],['batch',t.batch]])+select(id,'timing',t.timing,[['adapt_before_predict',t.adaptFirst],['predict_before_update',t.predictFirst]]),'<div class="protocol-steps" aria-live="polite"></div>'+result+`<button type="button" class="export-protocol">${esc(t.download)}</button>`,t.protocolNote);
      function config(){return {name:t.exportName,locale,illustrative:true,task:'single_frame_IRSTD',sequence:['A','B','A'],candidate_datasets:['NUAA-SIRST','NUDT-SIRST','IRSTD-1k'],stream_type:'controlled_domain_sequence_of_independent_images',mode:$('[data-control="mode"]',el).value,test_unit:$('[data-control="unit"]',el).value,prediction_timing:$('[data-control="timing"]',el).value,target_labels_for_update:false,source_checkpoint:'SET_BEFORE_EXPERIMENT',parameter_subset:'SET_BEFORE_EXPERIMENT',optimizer:'SET_BEFORE_EXPERIMENT',learning_rate:null,seed:null,steps_per_unit:1,reset_optimizer_with_model:true,metrics:['IoU','nIoU','Pd','Fa','latency_ms','peak_memory_mb'],note:t.exportNote};}
      bind(el,()=>{const c=config(),episodic=c.mode==='episodic',before=c.prediction_timing==='predict_before_update';$('.protocol-steps',el).innerHTML=['A','B','A'].map((domain,i)=>`<div class="protocol-step"><strong>${domain}</strong><span>${esc(tr('unit',{n:i+1}))} · ${esc(before?t.predictFirstShort:t.adaptFirstShort)}</span><span>${esc(episodic?t.discard:tr('carry',{from:i,to:i+1}))}</span></div>`).join('');$('.demo-result',el).textContent=(episodic?t.episodicExplanation:t.continualExplanation)+' '+(episodic&&before?t.frozenWarning:before?t.futureOnly:t.reforward);});
      $('.export-protocol',el).addEventListener('click',()=>{const blob=new Blob([JSON.stringify(config(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='irstd-adaptation-protocol.json';root.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    }
  };
  $$('[data-demo]').forEach(el=>demos[el.dataset.demo]?.(el));
  $$('.hero-art').forEach(el=>{
    if(el.children.length)return;let pixels='';for(let r=0;r<12;r++)for(let c=0;c<24;c++){const target=Math.exp(-((r-5)**2+(c-15)**2)/1.4),haze=(Math.sin(r*.8+c*.38)+Math.cos(c*.4-r*.7)+2)/4;pixels+=`<rect x="${c*25}" y="${r*22}" width="23" height="20" fill="var(--accent)" opacity="${.025+haze*.1+target*.8}"/>`;}
    el.innerHTML=`<svg viewBox="0 0 600 264" role="img" aria-label="${esc(t.heroTitle)}"><title>${esc(t.heroTitle)}</title>${pixels}<path d="M30 45 H560 V90 H45 V135 H560 V180 H45" stroke="var(--accent)" stroke-width="1" fill="none" opacity=".25"/><rect x="347" y="86" width="80" height="78" rx="3" fill="none" stroke="var(--accent)"/><path d="M334 125 H347 M427 125 H440 M387 74 V86 M387 164 V177" stroke="var(--accent)"/><text x="30" y="213" fill="var(--accent)">${esc(t.heroSignal)}</text><text x="30" y="234" fill="var(--muted)">${esc(t.heroProcess)}</text><text x="570" y="234" text-anchor="end" fill="var(--muted)">${esc(t.heroFooter)}</text></svg><span class="art-caption">${esc(t.heroCaption)}</span>`;
  });
}

if (typeof document !== 'undefined') document.querySelectorAll('.learning-course').forEach(initializeLearning);
