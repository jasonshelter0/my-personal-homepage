import {
  missionIds,
  starters,
  targetSettings,
  fixture,
  attention,
  validate,
  exportPython,
  decodeState,
  encodeState,
  futureEffect,
} from './engine.mjs';
import { courseActivity } from '../pytorch-progress.js';
const root = document.querySelector('[data-attention-lab]');
if (root) {
  const q = (name) => root.querySelector(`[data-at-${name}]`),
    t = JSON.parse(q('copy').textContent),
    u = t.ui;
  const fmt = (x) => (x === -Infinity ? '−∞' : Number(x.toPrecision(5)).toString());
  const compact = (x) =>
    !Number.isFinite(x)
      ? fmt(x)
      : x !== 0 && Math.abs(x) < 0.01
        ? x.toExponential(1)
        : Number(x.toPrecision(3)).toString();
  const node = (tag, text, attrs = {}) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  let state = decodeState(),
    stage = 'raw',
    reference = false,
    completed = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem('learnpytorch-attention-v1') || '[]');
    if (Array.isArray(saved)) completed = new Set(saved.filter((id) => missionIds.includes(id)));
  } catch {
    q('storage').hidden = false;
  }
  const message = (text, kind = 'info') => {
    q('feedback').textContent = text;
    q('feedback').dataset.kind = kind;
  };
  const letter = (i) => String.fromCharCode(65 + i);
  function progress() {
    q('progress').textContent = `${u.progress} ${completed.size} / 6`;
    root.querySelectorAll('[data-at-mission]').forEach((b) => {
      b.setAttribute('aria-current', b.dataset.atMission === state.mission ? 'step' : 'false');
      b.classList.toggle('is-complete', completed.has(b.dataset.atMission));
    });
    courseActivity('attention', state.mission, [...completed]);
  }
  function changed() {
    q('success').hidden = true;
    q('probe-result').textContent = '';
    q('share-box').hidden = true;
    q('share-feedback').textContent = '';
    reference = false;
    message(u.changed);
    render();
  }
  function load(hash = location.hash) {
    let invalid = false;
    try {
      state = decodeState(hash);
    } catch {
      state = decodeState();
      invalid = true;
    }
    stage = {
      scores: 'raw',
      scale: 'logits',
      axis: 'weights',
      causal: 'weights',
      values: 'output',
      capstone: 'weights',
    }[state.mission];
    reference = false;
    const m = t.missions[missionIds.indexOf(state.mission)];
    for (const name of ['title', 'hook', 'goal', 'takeaway', 'transfer'])
      q(name).textContent = m[name];
    q('success').hidden = true;
    q('hint-text').hidden = true;
    q('share-box').hidden = true;
    q('share-feedback').textContent = '';
    q('probe-result').textContent = '';
    q('example').value = String(state.example);
    q('temperature').value = String(state.temperature);
    message(invalid ? u.invalid : u.ready, invalid ? 'error' : 'info');
    progress();
    render();
  }
  function navigate(id) {
    const hash = `#attention-${id}`;
    history.pushState(null, '', hash);
    load(hash);
  }
  function table(data, heading) {
    const wrap = node('div', undefined, { class: 'at-input-table' });
    wrap.append(node('h4', heading));
    const tbl = node('table');
    data.forEach((row, i) => {
      const tr = node('tr');
      tr.append(node('th', letter(i), { scope: 'row' }));
      row.forEach((v) => tr.append(node('td', fmt(v))));
      tbl.append(tr);
    });
    wrap.append(tbl);
    return wrap;
  }
  function render() {
    const data = fixture(state.example),
      actual = attention(data, state.settings, state.temperature),
      shown = reference
        ? attention(data, targetSettings(state.mission), state.temperature)
        : actual;
    const settings = shown.settings,
      n = data.q.length;
    state.row = Math.min(state.row, n - 1);
    state.column = Math.min(state.column, n - 1);
    for (const control of root.querySelectorAll('[data-at-setting]')) {
      const key = control.dataset.atSetting;
      if (control.type === 'checkbox') control.checked = state.settings[key];
      else control.value = String(state.settings[key]);
    }
    root
      .querySelectorAll('[data-at-stage]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.atStage === stage)));
    q('result').setAttribute('aria-pressed', String(!reference));
    q('target').setAttribute('aria-pressed', String(reference));
    q('view-note').textContent = reference ? u.referenceNote : u.inspect;
    q('matrix-title').textContent =
      `${u[stage]} · [${shown[stage].length}, ${shown[stage][0].length}]`;
    const container = q('matrix'),
      matrix = shown[stage];
    container.replaceChildren();
    container.style.setProperty('--at-cols', String(matrix[0].length));
    const max = Math.max(1, ...matrix.flat().filter(Number.isFinite).map(Math.abs));
    container.append(node('span', stage === 'output' ? 'Q' : 'Q / K', { class: 'at-axis-label' }));
    matrix[0].forEach((_, j) =>
      container.append(
        node('span', stage === 'output' ? String(j) : letter(j), { class: 'at-axis-label' }),
      ),
    );
    matrix.forEach((row, i) => {
      container.append(node('span', letter(i), { class: 'at-axis-label' }));
      row.forEach((value, j) => {
        const b = node('button', compact(value), {
          type: 'button',
          'data-at-cell': `${i},${j}`,
          'data-value': String(value),
          'aria-label': `${u.row} ${letter(i)}, ${stage === 'output' ? u.feature : u.column} ${stage === 'output' ? j : letter(j)}: ${fmt(value)}`,
          'aria-pressed': i === state.row && j === state.column,
        });
        b.style.setProperty(
          '--at-strength',
          `${Number.isFinite(value) ? 10 + (Math.abs(value) / max) * 60 : 0}%`,
        );
        if (value < 0) b.classList.add('at-negative');
        if (value === -Infinity) b.classList.add('at-blocked');
        b.addEventListener('click', () => {
          state.row = i;
          state.column = Math.min(j, n - 1);
          render();
          q('matrix').querySelector(`[data-at-cell="${i},${j}"]`)?.focus({ preventScroll: true });
        });
        container.append(b);
      });
    });
    q('row-sum').textContent =
      `${u.query} ${letter(state.row)} · ${u.rowSum}: ${fmt(shown.weights[state.row].reduce((a, b) => a + b, 0))}`;
    const flow = q('flow');
    flow.replaceChildren();
    shown.weights[state.row].forEach((weight, j) => {
      const b = node('button', undefined, {
        type: 'button',
        'data-at-token': j,
        'aria-pressed': state.column === j,
      });
      const text = node('span', `${letter(state.row)} → ${letter(j)}`),
        bar = node('span', undefined, { class: 'at-track' }),
        fill = node('span');
      fill.style.width = `${Math.min(100, weight * 100)}%`;
      bar.append(fill);
      b.append(text, bar, node('code', `${fmt(weight * 100)}%`));
      b.addEventListener('click', () => {
        state.column = j;
        render();
        q('flow').querySelector(`[data-at-token="${j}"]`)?.focus({ preventScroll: true });
      });
      flow.append(b);
    });
    const r = state.row,
      c = state.column,
      terms = shown.left[r].map((v, d) => `${fmt(v)} × ${fmt(shown.right[c][d])}`);
    const inspector = q('inspector');
    inspector.replaceChildren(
      node('h3', `${u.query} ${letter(r)} → ${u.key} ${letter(c)}`),
      node('p', `${u.local}: ${terms.join(' + ')} = ${fmt(shown.raw[r][c])}`),
      node(
        'p',
        `${u.denominator}: ${fmt(shown.divisor)} · ${u.weights}: ${fmt(shown.weights[r][c])}`,
      ),
    );
    if (settings.causal && c > r) inspector.append(node('p', `${u.blocked}: ${u.causal}`));
    inspector.append(node('h4', u.mix));
    shown.output[r].forEach((result, j) => {
      const expression = shown.weights[r]
        .map((w, i) => `${fmt(w)} × ${fmt(shown.values[i][j])}`)
        .join(' + ');
      inspector.append(node('p', `${u.feature} ${j}: ${expression} = ${fmt(result)}`));
    });
    q('temperature-value').textContent = String(state.temperature);
    q('code').textContent = exportPython(data, state.settings, state.temperature);
    q('inputs').replaceChildren(table(data.q, 'Q'), table(data.k, 'K'), table(data.v, 'V'));
  }
  root
    .querySelectorAll('[data-at-mission]')
    .forEach((b) => b.addEventListener('click', () => navigate(b.dataset.atMission)));
  root.querySelectorAll('[data-at-setting]').forEach((control) =>
    control.addEventListener('change', () => {
      const key = control.dataset.atSetting;
      state.settings[key] =
        control.type === 'checkbox'
          ? control.checked
          : key === 'axis'
            ? Number(control.value)
            : control.value;
      changed();
    }),
  );
  q('example').addEventListener('change', () => {
    state.example = Number(q('example').value);
    state.row = state.column = 0;
    changed();
  });
  q('temperature').addEventListener('input', () => {
    state.temperature = Number(q('temperature').value);
    changed();
  });
  root.querySelectorAll('[data-at-stage]').forEach((b) =>
    b.addEventListener('click', () => {
      stage = b.dataset.atStage;
      render();
    }),
  );
  q('result').addEventListener('click', () => {
    reference = false;
    render();
  });
  q('target').addEventListener('click', () => {
    reference = true;
    render();
  });
  q('reset').addEventListener('click', () => {
    history.replaceState(null, '', `#attention-${state.mission}`);
    load();
  });
  q('hint').addEventListener('click', () => {
    q('hint-text').hidden = false;
    q('hint-text').textContent = t.missions[missionIds.indexOf(state.mission)].hint;
  });
  q('check').addEventListener('click', () => {
    reference = false;
    const pass = validate(state.mission, state.settings);
    q('success').hidden = !pass;
    if (pass) {
      completed.add(state.mission);
      try {
        localStorage.setItem('learnpytorch-attention-v1', JSON.stringify([...completed]));
      } catch {
        q('storage').hidden = false;
      }
      message(u.pass, 'success');
      progress();
    } else
      message(
        u[
          {
            scores: 'wrongScores',
            scale: 'wrongScale',
            axis: 'wrongAxis',
            causal: 'wrongCausal',
            values: 'wrongValues',
            capstone: 'wrongCapstone',
          }[state.mission]
        ],
        'error',
      );
    render();
  });
  q('next').addEventListener('click', () => {
    const i = missionIds.indexOf(state.mission);
    if (i < missionIds.length - 1) navigate(missionIds[i + 1]);
    else {
      message(u.finish, 'success');
      q('example').focus();
    }
  });
  q('probe').addEventListener('click', () => {
    const probe = futureEffect(
      fixture(state.example),
      reference ? targetSettings(state.mission) : state.settings,
      state.temperature,
    );
    q('probe-result').textContent =
      `${reference ? u.target : u.result} · ${u.before}: [${probe.original.map(fmt).join(', ')}] → ${u.after}: [${probe.altered.map(fmt).join(', ')}] · ${u.delta}: ${fmt(probe.delta)}`;
  });
  function shareURL() {
    return `${location.origin}${root.dataset.shareBase}${encodeState(state)}`;
  }
  q('share').addEventListener('click', async () => {
    const url = shareURL();
    try {
      await navigator.clipboard.writeText(url);
      q('share-feedback').textContent = u.copied;
    } catch {
      q('share-box').hidden = false;
      q('share-url').value = url;
      q('share-url').select();
    }
  });
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = node('a', undefined, { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  q('export').addEventListener('click', () =>
    download(
      new Blob([exportPython(fixture(state.example), state.settings, state.temperature)], {
        type: 'text/x-python;charset=utf-8',
      }),
      `learnpytorch-attention-${state.mission}.py`,
    ),
  );
  q('card').addEventListener('click', () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error();
      const result = attention(fixture(state.example), state.settings, state.temperature),
        n = result.weights.length;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1200, 720);
      ctx.fillStyle = '#5eead4';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('LearnPyTorch · Attention Detective', 48, 60);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 38px sans-serif';
      ctx.fillText(t.missions[missionIds.indexOf(state.mission)].title, 48, 120, 1100);
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(u.cardCaption, 48, 165, 1100);
      result.weights.forEach((row, i) =>
        row.forEach((v, j) => {
          const x = 70 + j * 100,
            y = 220 + i * 90;
          ctx.fillStyle = `rgb(${Math.round(20 + v * 50)},${Math.round(45 + v * 175)},${Math.round(60 + v * 145)})`;
          ctx.fillRect(x, y, 88, 78);
          ctx.fillStyle = '#f8fafc';
          ctx.font = '22px monospace';
          ctx.fillText(compact(v), x + 8, y + 46, 74);
        }),
      );
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '24px sans-serif';
      const probe = futureEffect(fixture(state.example), state.settings, state.temperature);
      const lines = [
        `${u.example}: ${state.example + 1}`,
        `${u.orientation}: ${state.settings.orientation === 'qk' ? 'Q @ Kᵀ' : 'K @ Qᵀ'}`,
        `√dₖ: ${state.settings.scale ? '✓' : '×'} · dim=${state.settings.axis} · T=${state.temperature}`,
        `${u.causal}: ${state.settings.causal ? '✓' : '×'}`,
        `${u.values}: ${state.settings.values.toUpperCase()}`,
        `${u.delta}: ${fmt(probe.delta)}`,
      ];
      lines.forEach((line, i) => ctx.fillText(line, 550, 250 + i * 48, 600));
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px sans-serif';
      ctx.fillText(u.notSemantic, 48, 630, 1100);
      ctx.fillStyle = '#5eead4';
      ctx.font = '19px monospace';
      ctx.fillText(
        `${location.host}/learn/learnpytorch/attention/#attention-${state.mission}`,
        48,
        675,
        1100,
      );
      canvas.toBlob((blob) => {
        if (!blob) {
          q('share-feedback').textContent = u.cardError;
          return;
        }
        download(blob, `learnpytorch-attention-${state.mission}.png`);
        q('share-feedback').textContent = u.cardSaved;
      }, 'image/png');
    } catch {
      q('share-feedback').textContent = u.cardError;
    }
  });
  window.addEventListener('hashchange', () => load());
  load();
}
