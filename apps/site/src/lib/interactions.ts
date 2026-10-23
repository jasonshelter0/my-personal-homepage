const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const glow = document.querySelector<HTMLElement>('.cursor-glow');
let frame = 0;
let mouseX = 0;
let mouseY = 0;
function hideGlow() {
  cancelAnimationFrame(frame);
  frame = 0;
  if (glow) glow.dataset.active = 'false';
}
window.addEventListener(
  'pointermove',
  (event) => {
    if (!glow) return;
    if (reducedMotion.matches || event.pointerType !== 'mouse') {
      hideGlow();
      return;
    }
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      glow.style.setProperty('--mouse-x', `${mouseX}px`);
      glow.style.setProperty('--mouse-y', `${mouseY}px`);
      glow.dataset.active = 'true';
      frame = 0;
    });
  },
  { passive: true },
);
window.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget) hideGlow();
});
window.addEventListener('blur', hideGlow);
reducedMotion.addEventListener('change', (event) => {
  if (event.matches) hideGlow();
});
const nav = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav]')];
if (nav.length) {
  const sections = nav
    .map((link) => document.getElementById(link.dataset.nav!))
    .filter(Boolean) as HTMLElement[];
  const updateActive = () => {
    let active = sections[0];
    for (const section of sections)
      if (section.getBoundingClientRect().top < window.innerHeight * 0.4) active = section;
    for (const link of nav) {
      const selected = link.dataset.nav === active?.id;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
}
const search = document.querySelector<HTMLDialogElement>('#search-dialog')!;
const imageDialog = document.querySelector<HTMLDialogElement>('#image-dialog')!;
const input = document.querySelector<HTMLInputElement>('#search-input')!;
let previousFocus: HTMLElement | null = null;
function openDialog(dialog: HTMLDialogElement) {
  previousFocus = document.activeElement as HTMLElement;
  dialog.showModal();
  document.body.style.overflow = 'hidden';
}
for (const dialog of [search, imageDialog]) {
  dialog.querySelector('[data-close-dialog]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    previousFocus?.focus();
  });
}
document.querySelector('[data-open-search]')?.addEventListener('click', () => {
  openDialog(search);
  input.focus();
});
document.addEventListener('keydown', (event) => {
  // Search inputs may consume the first Escape to clear their value. Close the
  // active modal explicitly so the documented shortcut behaves consistently.
  if (event.key === 'Escape' && (search.open || imageDialog.open)) {
    event.preventDefault();
    if (search.open) search.close();
    if (imageDialog.open) imageDialog.close();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (search.open) search.close();
    else {
      imageDialog.close();
      openDialog(search);
      input.focus();
    }
  }
});
function openImage(src: string, alt: string, caption: string) {
  const image = imageDialog.querySelector('img')!;
  image.src = src;
  image.alt = alt;
  imageDialog.querySelector('figcaption')!.textContent = caption;
  openDialog(imageDialog);
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-image]'))
  button.addEventListener('click', () =>
    openImage(
      button.dataset.image!,
      button.querySelector('img')?.alt || '',
      button.dataset.caption || '',
    ),
  );
for (const image of document.querySelectorAll<HTMLImageElement>('.prose img')) {
  image.tabIndex = 0;
  image.setAttribute('role', 'button');
  image.addEventListener('click', () => openImage(image.src, image.alt, image.title || image.alt));
  image.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openImage(image.src, image.alt, image.title || image.alt);
    }
  });
}
document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
interface SearchData {
  url: string;
  meta: { title?: string };
  excerpt: string;
}
interface Pagefind {
  options: (options: Record<string, unknown>) => Promise<void>;
  search: (
    query: string,
    options?: { filters?: Record<string, string> },
  ) => Promise<{ results: { data: () => Promise<SearchData> }[] }>;
}
let pagefind: Promise<Pagefind> | undefined;
let queryId = 0;
let searchFilter = '';
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-search-filter]'))
  button.addEventListener('click', () => {
    searchFilter = button.dataset.searchFilter!;
    for (const other of document.querySelectorAll<HTMLButtonElement>('[data-search-filter]'))
      other.setAttribute('aria-pressed', String(other === button));
    input.dispatchEvent(new Event('input'));
  });
let timer: ReturnType<typeof setTimeout>;
const results = document.querySelector('#search-results')!;
const status = document.querySelector('#search-status')!;
function excerptFragment(html: string) {
  // Preserve only Pagefind highlight marks. No HTML from content can execute here.
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const fragment = document.createDocumentFragment();
  const append = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE)
      parent.appendChild(document.createTextNode(node.textContent || ''));
    else if (node instanceof Element) {
      const target = node.tagName === 'MARK' ? document.createElement('mark') : parent;
      if (target !== parent) parent.appendChild(target);
      for (const child of node.childNodes) append(child, target);
    }
  };
  for (const child of parsed.body.childNodes) append(child, fragment);
  return fragment;
}
input.addEventListener('input', () => {
  clearTimeout(timer);
  const id = ++queryId;
  const query = input.value.trim();
  results.replaceChildren();
  if (!query) {
    status.textContent = search.dataset.hint!;
    return;
  }
  status.textContent = search.dataset.loading!;
  timer = setTimeout(async () => {
    try {
      if (!pagefind) {
        const path = '/pagefind/pagefind.js';
        pagefind = import(/* @vite-ignore */ path)
          .then(async (module) => {
            await module.options({});
            return module;
          })
          .catch((error) => {
            pagefind = undefined;
            throw error;
          });
      }
      const engine = await pagefind;
      const found = await engine.search(
        query,
        searchFilter ? { filters: { type: searchFilter } } : {},
      );
      const data = await Promise.all(found.results.slice(0, 15).map((result) => result.data()));
      if (id !== queryId) return;
      results.replaceChildren();
      status.textContent = data.length
        ? search.dataset.count!.replace('{count}', String(found.results.length))
        : search.dataset.empty!;
      for (const item of data) {
        const url = new URL(item.url, location.origin);
        if (url.origin !== location.origin) continue;
        const link = document.createElement('a');
        link.href = url.pathname + url.search + url.hash;
        link.className = 'search-result';
        link.setAttribute('role', 'listitem');
        const title = document.createElement('h3');
        title.textContent = item.meta.title || item.url;
        const excerpt = document.createElement('p');
        excerpt.append(excerptFragment(item.excerpt));
        link.append(title, excerpt);
        results.append(link);
      }
    } catch {
      if (id === queryId) status.textContent = search.dataset.unavailable!;
    }
  }, 180);
});

export {};
