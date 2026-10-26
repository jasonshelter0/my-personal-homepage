const reader = document.querySelector<HTMLElement>('[data-learning-reader]');
if (reader) {
  const root = document.documentElement;
  const toggle = reader.querySelector<HTMLButtonElement>('[data-reader-toggle]')!;
  const fullscreen = reader.querySelector<HTMLButtonElement>('[data-reader-fullscreen]')!;
  const status = reader.querySelector<HTMLElement>('[data-reader-status]')!;
  const key = 'folio:learning:immersive';
  const active = () => root.dataset.readerMode === 'immersive';
  const ownsFullscreen = () => document.fullscreenElement === root;
  function sync() {
    toggle.setAttribute('aria-pressed', String(active()));
    reader!.querySelector('[data-reader-label]')!.textContent = active() ? reader!.dataset.exit! : reader!.dataset.enter!;
    fullscreen.setAttribute('aria-pressed', String(ownsFullscreen()));
    fullscreen.setAttribute('aria-label', ownsFullscreen() ? reader!.dataset.leaveFull! : reader!.dataset.full!);
    fullscreen.title = fullscreen.getAttribute('aria-label')!;
    reader!.querySelector('[data-fullscreen-label]')!.textContent = ownsFullscreen() ? reader!.dataset.leaveFull! : reader!.dataset.full!;
  }
  function setMode(enabled: boolean) {
    // Keep the current reading passage in view when the columns reflow.
    const anchor = [...document.querySelectorAll<HTMLElement>('main article h1, main article h2, main article h3, main article p')]
      .find((el) => { const r = el.getBoundingClientRect(); return r.top >= 80 && r.top < innerHeight && r.height > 0; });
    const top = anchor?.getBoundingClientRect().top;
    const scrolled = scrollY > 0;
    root.dataset.readerMode = enabled ? 'immersive' : 'normal';
    try { localStorage.setItem(key, enabled ? '1' : '0'); } catch { /* Reading works without storage. */ }
    sync();
    if (scrolled && anchor && top !== undefined) scrollBy({ top: anchor.getBoundingClientRect().top - top, behavior: 'instant' });
    status.textContent = '';
  }
  async function leave() {
    if (ownsFullscreen()) {
      try { await document.exitFullscreen(); } catch { /* Keep the layout exit usable. */ }
    }
    setMode(false);
    toggle.focus({ preventScroll: true });
  }
  toggle.addEventListener('click', () => { if (active()) void leave(); else setMode(true); });
  fullscreen.hidden = !document.fullscreenEnabled;
  fullscreen.addEventListener('click', async () => {
    if (ownsFullscreen()) {
      try { await document.exitFullscreen(); } catch { status.textContent = reader!.dataset.unavailable!; }
    } else {
      setMode(true);
      try { await root.requestFullscreen(); } catch { status.textContent = reader!.dataset.unavailable!; }
    }
    sync();
  });
  document.addEventListener('fullscreenchange', sync);
  // Capture the pre-event context so nested dialogs/labs get the first Escape.
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !active() || document.fullscreenElement ||
        document.querySelector('dialog[open], .git-stage.is-expanded, .tl-expanded') ||
        (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    event.preventDefault();
    void leave();
  }, true);
  reader.hidden = false;
  sync();
}
export {};
