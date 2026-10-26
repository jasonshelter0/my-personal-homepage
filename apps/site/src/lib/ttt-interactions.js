import { scalarTTT, makeTTTPlan, TTT_EXPERIMENTS } from './ttt-learning.js';
import { tttUI } from './ttt-learning-ui.js';

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let serial = 0;
const defaults = { w0: 0, k: 2, v: 1, q: 3, eta: 0.1, steps: 1 };

function trajectory(values, title, axis, format, color) {
  const width = 560, height = 230, left = 62, right = 18, top = 20, bottom = 40;
  let low = Math.min(0, ...values), high = Math.max(0, ...values);
  if (high === low) { low -= 0.5; high += 0.5; }
  const padding = (high - low) * 0.08;
  low -= padding; high += padding;
  const x = i => left + i / Math.max(1, values.length - 1) * (width - left - right);
  const y = v => height - bottom - (v - low) / (high - low) * (height - top - bottom);
  let marks = '';
  for (let i = 0; i <= 4; i++) {
    const value = low + i * (high - low) / 4;
    marks += `<line x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}" stroke="var(--line)"/><text x="${left-8}" y="${y(value)+4}" text-anchor="end">${escapeHTML(format(value))}</text>`;
  }
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return `<svg class="chart ttt-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(title)}"><title>${escapeHTML(title)}</title>${marks}<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5"/>${values.map((v,i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${color}"/>`).join('')}<text x="${left}" y="${height-23}">0</text><text x="${width-right}" y="${height-23}" text-anchor="end">${values.length-1}</text><text x="${width/2}" y="${height-5}" text-anchor="middle">${escapeHTML(axis)}</text></svg>`;
}

export function initializeTTT(root) {
  const locale = Object.hasOwn(tttUI, root.dataset.locale) ? root.dataset.locale : 'en';
  const t = tttUI[locale];
  const format = value => new Intl.NumberFormat(locale, Math.abs(value) >= 1e5 || (value !== 0 && Math.abs(value) < 0.0001) ? { notation: 'scientific', maximumFractionDigits: 3 } : { maximumFractionDigits: 4 }).format(value);
  const metric = (label, value, attr = '') => `<div class="metric"><span>${escapeHTML(label)}</span><strong ${attr}>${escapeHTML(value)}</strong></div>`;
  for (const el of root.querySelectorAll('[data-demo="ttt-inner"], [data-demo="ttt-plan"]')) {
    if (el.dataset.tttReady === 'true') continue;
    el.dataset.tttReady = 'true';
    const id = `ttt-widget-${++serial}`;
    const control = name => el.querySelector(`[data-ttt-control="${name}"]`);
    const labelInput = (name, label, min, max, step, value) => `<div class="demo-control"><label for="${id}-${name}">${escapeHTML(label)}<output data-ttt-value="${name}" for="${id}-${name}"></output></label><input id="${id}-${name}" data-ttt-control="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-labelledby', `${id}-title`);
    if (el.dataset.demo === 'ttt-inner') {
      el.innerHTML = `<div class="demo-heading"><h3 id="${id}-title">${escapeHTML(t.innerTitle)}</h3><span class="demo-badge">${escapeHTML(t.demo)}</span></div><p class="demo-description">${escapeHTML(t.innerDescription)}</p><div class="equation">L = ½(wk − v)²<br>g = (wk − v)k<br>w ← w − ηg ; readout = wq</div><div class="demo-controls">${labelInput('w0',t.w0,-2,2,.1,0)}${labelInput('k',t.k,-3,3,.1,2)}${labelInput('v',t.v,-3,3,.1,1)}${labelInput('q',t.q,-4,4,.1,3)}${labelInput('eta',t.eta,0,1,.01,.1)}${labelInput('steps',t.steps,0,20,1,1)}</div><div class="actions"><button type="button" data-ttt-action="step">${escapeHTML(t.step)}</button><button type="button" data-ttt-action="reset">${escapeHTML(t.reset)}</button></div><div class="metrics" data-ttt-metrics></div><p class="demo-result" data-ttt-status aria-live="polite"></p><div class="ttt-plots"><div data-ttt-weight-plot></div><div data-ttt-loss-plot></div></div><details><summary>${escapeHTML(t.history)}</summary><div class="table-wrap" tabindex="0"><table><thead><tr><th scope="col">${escapeHTML(t.iteration)}</th><th scope="col">w</th><th scope="col">L</th><th scope="col">wq</th></tr></thead><tbody data-ttt-history></tbody></table></div></details><p class="demo-footnote">${escapeHTML(t.innerNote)}</p>`;
      function update() {
        const params = Object.fromEntries(Object.keys(defaults).map(name => [name, Number(control(name).value)]));
        for (const [name, value] of Object.entries(params)) el.querySelector(`[data-ttt-value="${name}"]`).textContent = format(value);
        const state = scalarTTT(params);
        const last = state.history.at(-1);
        el.querySelector('[data-ttt-metrics]').innerHTML = metric(t.weight,format(last.w),'data-ttt-metric="weight"') + metric(t.loss,format(last.loss),'data-ttt-metric="loss"') + metric(t.readout,format(last.readout),'data-ttt-metric="readout"') + metric(t.gradient,format(last.gradient));
        el.querySelector('[data-ttt-status]').textContent = `${params.steps === 0 ? t.zero + ' ' : ''}${t[state.regime]}${state.stopped ? ' ' + t.stopped : ''}`;
        el.querySelector('[data-ttt-weight-plot]').innerHTML = `<h4>${escapeHTML(t.weight)}</h4>` + trajectory(state.history.map(x => x.w),t.weight,t.iteration,format,'var(--accent)');
        el.querySelector('[data-ttt-loss-plot]').innerHTML = `<h4>${escapeHTML(t.loss)}</h4>` + trajectory(state.history.map(x => x.loss),t.loss,t.iteration,format,'var(--learning-warning, #fbad80)');
        el.querySelector('[data-ttt-history]').innerHTML = state.history.map(x => `<tr><td>${x.step}</td><td>${escapeHTML(format(x.w))}</td><td>${escapeHTML(format(x.loss))}</td><td>${escapeHTML(format(x.readout))}</td></tr>`).join('');
        el.querySelector('[data-ttt-action="step"]').disabled = params.steps >= 20;
      }
      el.querySelectorAll('input').forEach(input => input.addEventListener('input', update));
      el.querySelector('[data-ttt-action="step"]').addEventListener('click', () => { control('steps').value = String(Math.min(20, Number(control('steps').value) + 1)); update(); });
      el.querySelector('[data-ttt-action="reset"]').addEventListener('click', () => { for (const [name, value] of Object.entries(defaults)) control(name).value = String(value); update(); });
      update();
    } else {
      const option = (name,label,values) => `<div class="demo-control"><label for="${id}-${name}">${escapeHTML(label)}</label><select id="${id}-${name}" data-ttt-control="${name}">${values.map(x => `<option value="${x}">${x}</option>`).join('')}</select></div>`;
      const number = (name,label,value,max) => `<div class="demo-control"><label for="${id}-${name}">${escapeHTML(label)}</label><input class="ttt-number" id="${id}-${name}" data-ttt-control="${name}" type="number" min="1" max="${max}" step="1" value="${value}"></div>`;
      const purpose = { smoke:t.smoke, baseline:t.baseline, centroid:t.centroidPurpose, inner_steps:t.innerSteps, high_resolution:t.high };
      el.innerHTML = `<div class="demo-heading"><h3 id="${id}-title">${escapeHTML(t.planTitle)}</h3><span class="demo-badge">${escapeHTML(t.demo)}</span></div><p class="demo-description">${escapeHTML(t.planDescription)}</p><div class="demo-controls">${option('resolution',t.resolution,[256,512])}${option('seeds',t.seeds,[1,3])}${number('epochs',t.epochs,100,10000)}${number('stepsPerEpoch',t.stepsEpoch,100,100000)}${option('gpuCount',t.gpuCount,[1,2,4,8])}</div><fieldset class="ttt-experiments"><legend>${escapeHTML(t.choose)}</legend>${TTT_EXPERIMENTS.map(x => `<div class="ttt-experiment"><label class="ttt-choice"><input type="checkbox" data-ttt-experiment="${x.id}" ${['S0','B0','B1'].includes(x.id)?'checked':''}><span><strong>${x.id} · ${escapeHTML(purpose[x.purpose])}</strong><small>${escapeHTML(t[x.model])}</small></span></label><div class="demo-control"><label for="${id}-speed-${x.id}">${escapeHTML(t.measured)} · ${x.id}</label><input class="ttt-number" id="${id}-speed-${x.id}" data-ttt-speed="${x.id}" type="number" min="0.000001" step="any" placeholder="${escapeHTML(t.placeholder)}"></div></div>`).join('')}</fieldset><div class="metrics" data-ttt-cost></div><p class="demo-result" data-ttt-plan-status aria-live="polite"></p><div class="table-wrap" tabindex="0"><table><thead><tr><th scope="col">${escapeHTML(t.experiment)}</th><th scope="col">${escapeHTML(t.setting)}</th><th scope="col">${escapeHTML(t.runs)}</th></tr></thead><tbody data-ttt-matrix></tbody></table></div><button type="button" data-ttt-action="export">${escapeHTML(t.export)}</button><p data-ttt-export-status role="status"></p><p class="demo-footnote">${escapeHTML(t.planNote)}</p>`;
      let current = null;
      let previousResolution = Number(control('resolution').value);
      function update() {
        const values = Object.fromEntries(['resolution','seeds','epochs','stepsPerEpoch','gpuCount'].map(name => [name,Number(control(name).value)]));
        const resolutionChanged = values.resolution !== previousResolution;
        if (resolutionChanged) {
          for (const experiment of TTT_EXPERIMENTS.filter(x => x.resolution === null)) el.querySelector(`[data-ttt-speed="${experiment.id}"]`).value = '';
          previousResolution = values.resolution;
        }
        const speeds = Object.fromEntries([...el.querySelectorAll('[data-ttt-speed]')].map(input => [input.dataset.tttSpeed,input.value.trim() === '' ? null : Number(input.value)]));
        const invalidSpeed = [...el.querySelectorAll('[data-ttt-speed]')].some(input => input.value !== '' && (!Number.isFinite(Number(input.value)) || Number(input.value) <= 0));
        const status = el.querySelector('[data-ttt-plan-status]');
        el.querySelector('[data-ttt-export-status]').textContent = '';
        try {
          if (invalidSpeed || !['epochs','stepsPerEpoch'].every(name => control(name).checkValidity())) throw new RangeError('Invalid inputs');
          current = makeTTTPlan({ ...values, ids:[...el.querySelectorAll('[data-ttt-experiment]:checked')].map(x => x.dataset.tttExperiment), secondsPerStep:speeds });
          current.locale = locale;
          const cost = current.estimate;
          el.querySelector('[data-ttt-cost]').innerHTML = metric(t.plannedRuns,String(cost.runCount)) + metric(t.gpuHours,cost.complete?format(cost.gpuHours):'—','data-ttt-metric="gpu-hours"') + metric(t.wallHours,cost.complete?format(cost.idealWallHours):'—','data-ttt-metric="wall-hours"');
          status.textContent = (resolutionChanged ? t.resolutionChanged + ' ' : '') + (!current.jobs.length ? t.empty : cost.complete ? t.complete : t.missing);
          el.querySelector('[data-ttt-matrix]').innerHTML = current.jobs.map(x => `<tr><th scope="row">${x.id}</th><td>${escapeHTML(t[x.model])}<br>${x.resolution} × ${x.resolution}<br>${escapeHTML(purpose[x.purpose])}</td><td>${x.seeds} × ${x.epochs} × ${x.stepsPerEpoch}</td></tr>`).join('');
          el.querySelector('[data-ttt-action="export"]').disabled = current.jobs.length === 0;
        } catch {
          current = null; status.textContent = t.validation;
          el.querySelector('[data-ttt-cost]').textContent = '';
          el.querySelector('[data-ttt-matrix]').textContent = '';
          el.querySelector('[data-ttt-action="export"]').disabled = true;
        }
      }
      el.querySelectorAll('input,select').forEach(input => input.addEventListener('input', update));
      el.querySelector('[data-ttt-action="export"]').addEventListener('click', () => {
        if (!current?.jobs.length) return;
        const blob = new Blob([JSON.stringify(current,null,2)],{type:'application/json'});
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = 'irstd-ttt-replication-plan.json';
        root.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url),1000);
        el.querySelector('[data-ttt-export-status]').textContent = t.exported;
      });
      update();
    }
  }
}
