/** Attach one decorative glow without rerendering the editor on mouse movement. */
export function attachCursorGlow(glow: HTMLElement): () => void {
  let frame = 0;
  let mouseX = 0;
  let mouseY = 0;
  let lastTouch = -Infinity;
  function hide() {
    cancelAnimationFrame(frame);
    frame = 0;
    glow.dataset.active = 'false';
  }
  function move(event: MouseEvent) {
    // Ignore compatibility mouse events synthesized by touch browsers.
    if (Date.now() - lastTouch < 800) return;
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      glow.style.setProperty('--mouse-x', `${mouseX}px`);
      glow.style.setProperty('--mouse-y', `${mouseY}px`);
      glow.dataset.active = 'true';
      frame = 0;
    });
  }
  function touch() {
    lastTouch = Date.now();
    hide();
  }
  function leave(event: PointerEvent) {
    if (!event.relatedTarget) hide();
  }
  window.addEventListener('mousemove', move, { passive: true });
  const touchEvents = ['touchstart', 'touchmove', 'touchend'] as const;
  for (const event of touchEvents) window.addEventListener(event, touch, { passive: true });
  window.addEventListener('pointerout', leave);
  window.addEventListener('blur', hide);
  return () => {
    hide();
    window.removeEventListener('mousemove', move);
    for (const event of touchEvents) window.removeEventListener(event, touch);
    window.removeEventListener('pointerout', leave);
    window.removeEventListener('blur', hide);
  };
}
