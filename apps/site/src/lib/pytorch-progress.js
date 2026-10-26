const definitions = {
  tensor: {
    key: 'learnpytorch-progress-v1',
    ids: [
      'axes',
      'broadcast',
      'batch',
      'flatten',
      'squeeze',
      'channel-bias',
      'pool',
      'linear',
      'softmax',
    ],
  },
  autograd: {
    key: 'learnpytorch-autograd-v1',
    ids: ['chain', 'detach', 'accumulation', 'training'],
  },
  attention: {
    key: 'learnpytorch-attention-v1',
    ids: ['scores', 'scale', 'axis', 'causal', 'values', 'capstone'],
  },
};
let memory = {};
function read() {
  for (const [chapter, def] of Object.entries(definitions)) {
    try {
      const saved = JSON.parse(localStorage.getItem(def.key) || '[]');
      memory[chapter] = new Set(
        Array.isArray(saved) ? saved.filter((id) => def.ids.includes(id)) : [],
      );
    } catch {
      memory[chapter] ??= new Set();
    }
  }
}
function update() {
  read();
  for (const root of document.querySelectorAll('[data-pt-course]')) {
    const links = [...root.querySelectorAll('[data-pt-link]')];
    let count = 0;
    for (const link of links) {
      const done = memory[link.dataset.chapter].has(link.dataset.lessonId);
      link.classList.toggle('pt-done', done);
      link.querySelector('[data-pt-mark]').textContent = done ? '✓' : '○';
      if (done) count++;
    }
    const progress = root.querySelector('[data-pt-progress]');
    progress.textContent = `${progress.dataset.label} ${count} / ${links.length}`;
    let next = links.find((a) => !memory[a.dataset.chapter].has(a.dataset.lessonId));
    try {
      const saved = JSON.parse(localStorage.getItem('learnpytorch-last-v1') || 'null');
      const last = links.find(
        (a) => a.dataset.chapter === saved?.chapter && a.dataset.lessonId === saved?.id,
      );
      if (last) {
        const same = links.filter(
          (a) =>
            a.dataset.chapter === last.dataset.chapter &&
            !memory[a.dataset.chapter].has(a.dataset.lessonId),
        );
        next = !memory[last.dataset.chapter].has(last.dataset.lessonId) ? last : same[0] || next;
      }
    } catch {}
    const resume = root.querySelector('[data-pt-resume]');
    resume.href = (next || links[0]).href;
    resume.title =
      count === links.length ? resume.dataset.complete : next?.textContent.trim() || '';
  }
}
export function courseActivity(chapter, id, completed) {
  if (!definitions[chapter]?.ids.includes(id)) return;
  if (completed)
    memory[chapter] = new Set(completed.filter((v) => definitions[chapter].ids.includes(v)));
  try {
    localStorage.setItem('learnpytorch-last-v1', JSON.stringify({ chapter, id }));
  } catch {}
  update();
}
window.addEventListener('storage', update);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) update();
});
update();
