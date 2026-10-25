import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';
import {
  LOCALES,
  CURSOR_GLOW_RADIUS,
  type Entry,
  type EntryType,
  type Locale,
  type Snapshot,
  type Release,
  type ValidationIssue,
  type TranslationStatus,
} from '../../../shared/types';
import { messages, localeLabels, localizeServerMessage, type MessageKey } from './i18n';
import './style.css';
import { CursorGlow } from './CursorGlow';

const blankTranslation = () => ({
  title: '',
  summary: '',
  body: '',
  reviewed: false,
  sourceHash: '',
});
const uid = () => crypto.randomUUID();
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (body === undefined && ['POST', 'PUT', 'PATCH'].includes(method)) body = {};
  const r = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers:
      body instanceof FormData
        ? undefined
        : body === undefined
          ? undefined
          : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok)
    throw Object.assign(
      new Error(
        typeof j.error === 'string' ? j.error : j.error?.message || j.message || r.statusText,
      ),
      { status: r.status },
    );
  return j;
}
function safeUrl(url: string) {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url) ? url : '#';
}
function Markdown({ text }: { text: string }) {
  function render(tokens: any[], inline = false): ReactNode {
    return tokens.map((t, i) => {
      const children = t.tokens ? render(t.tokens, true) : t.text;
      switch (t.type) {
        case 'space':
          return null;
        case 'html':
          return <span key={i}>{t.raw}</span>;
        case 'heading':
          return React.createElement(`h${Math.min(t.depth, 6)}`, { key: i }, children);
        case 'paragraph':
          return <p key={i}>{children}</p>;
        case 'text':
          return <React.Fragment key={i}>{children}</React.Fragment>;
        case 'strong':
          return <strong key={i}>{children}</strong>;
        case 'em':
          return <em key={i}>{children}</em>;
        case 'del':
          return <del key={i}>{children}</del>;
        case 'link':
          return (
            <a key={i} href={safeUrl(t.href)} target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        case 'image':
          return <img key={i} src={safeUrl(t.href)} alt={t.text} />;
        case 'code':
          return (
            <pre key={i}>
              <code>{t.text}</code>
            </pre>
          );
        case 'codespan':
          return <code key={i}>{t.text}</code>;
        case 'blockquote':
          return <blockquote key={i}>{render(t.tokens)}</blockquote>;
        case 'list': {
          const Tag = t.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i}>
              {t.items.map((x: any, j: number) => (
                <li key={j}>{render(x.tokens)}</li>
              ))}
            </Tag>
          );
        }
        case 'br':
          return <br key={i} />;
        case 'hr':
          return <hr key={i} />;
        default:
          return <span key={i}>{t.raw}</span>;
      }
    });
  }
  return <div className="markdown">{render(marked.lexer(text))}</div>;
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function CursorGlowSettings({
  radius,
  onChange,
  t,
}: {
  radius: number;
  onChange: (radius: number) => void;
  t: (key: MessageKey) => string;
}) {
  const [input, setInput] = useState(String(radius));
  useEffect(() => setInput(String(radius)), [radius]);
  function setRadius(value: number) {
    setInput(String(value));
    onChange(value);
  }
  return (
    <section className="settings-section">
      <h2 id="cursor-glow-label">{t('cursorGlowRadius')}</h2>
      <p id="cursor-glow-help">{t('cursorGlowHelp')}</p>
      <div className="glow-controls">
        <div className="glow-slider">
          <input
            type="range"
            min={CURSOR_GLOW_RADIUS.min}
            max={CURSOR_GLOW_RADIUS.max}
            step={1}
            value={radius}
            aria-labelledby="cursor-glow-label"
            aria-describedby="cursor-glow-help"
            aria-valuetext={`${radius} px`}
            onChange={(e) => setRadius(e.target.valueAsNumber)}
          />
          <div className="glow-limits" aria-hidden="true">
            <span>{CURSOR_GLOW_RADIUS.min} px</span>
            <span>{CURSOR_GLOW_RADIUS.max} px</span>
          </div>
        </div>
        <div className="glow-number">
          <input
            type="number"
            min={CURSOR_GLOW_RADIUS.min}
            max={CURSOR_GLOW_RADIUS.max}
            step={1}
            value={input}
            aria-labelledby="cursor-glow-label"
            aria-describedby="cursor-glow-help"
            onChange={(e) => {
              setInput(e.target.value);
              const value = e.target.valueAsNumber;
              if (
                Number.isInteger(value) &&
                value >= CURSOR_GLOW_RADIUS.min &&
                value <= CURSOR_GLOW_RADIUS.max
              )
                onChange(value);
            }}
            onBlur={() => {
              const value = input.trim() === '' ? radius : Number(input);
              setRadius(
                Number.isFinite(value)
                  ? Math.min(
                      CURSOR_GLOW_RADIUS.max,
                      Math.max(CURSOR_GLOW_RADIUS.min, Math.round(value)),
                    )
                  : radius,
              );
            }}
          />
          <span aria-hidden="true">px</span>
        </div>
        <button type="button" onClick={() => setRadius(CURSOR_GLOW_RADIUS.default)}>
          {t('cursorGlowReset')}
        </button>
      </div>
    </section>
  );
}
function App() {
  const [ui, setUi] = useState<Locale>(
    (localStorage.getItem('studio-language') as Locale) || 'zh-CN',
  );
  const t = (key: MessageKey) => messages[ui]?.[key] || messages.en[key];
  const [session, setSession] = useState<{
      authenticated: boolean;
      localDemo: boolean;
      productionUrl?: string;
    } | null>(null),
    [password, setPassword] = useState(''),
    [snap, setSnap] = useState<Snapshot | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [conflict, setConflict] = useState(false);
  const [tab, setTab] = useState<
      'dashboard' | 'content' | 'profile' | 'appearance' | 'media' | 'releases'
    >('dashboard'),
    [selected, setSelected] = useState<string | null>(null),
    [locale, setLocale] = useState<Locale>('zh-CN'),
    [filter, setFilter] = useState<'all' | EntryType>('all'),
    [query, setQuery] = useState(''),
    [preview, setPreview] = useState(false),
    [imagePicker, setImagePicker] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]),
    [releaseData, setReleaseData] = useState<{ releases: Release[]; currentId: string | null }>({
      releases: [],
      currentId: null,
    }),
    [translation, setTranslation] = useState<TranslationStatus>({ configured: false, model: null });
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    document.documentElement.lang = ui;
    localStorage.setItem('studio-language', ui);
  }, [ui]);
  useEffect(() => {
    api<{ authenticated: boolean; localDemo: boolean; productionUrl?: string }>('/session')
      .then(setSession)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (session?.authenticated) void load();
  }, [session?.authenticated]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [dirty]);
  useEffect(() => {
    if (!session?.authenticated) return;
    const timer = setInterval(() => {
      if (tab === 'releases' || releaseData.releases.some((r) => r.status === 'building'))
        api<typeof releaseData>('/releases')
          .then(setReleaseData)
          .catch(() => {});
    }, 1800);
    return () => clearInterval(timer);
  }, [session?.authenticated, tab, releaseData.releases.some((r) => r.status === 'building')]);
  async function refresh() {
    const [v, r, tr] = await Promise.all([
      api<{ issues: ValidationIssue[] }>('/validation'),
      api<typeof releaseData>('/releases'),
      api<TranslationStatus>('/translation/status'),
    ]);
    setIssues(v.issues);
    setReleaseData(r);
    setTranslation(tr);
  }
  async function load() {
    try {
      setSnap(await api<Snapshot>('/snapshot'));
      setDirty(false);
      setConflict(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      if ((e as any).status === 409 && /draft changed/i.test((e as Error).message)) {
        setConflict(true);
        setError(t('conflict'));
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(mutator: (draft: Snapshot) => void) {
    if (!snap) return;
    const next = structuredClone(snap);
    mutator(next);
    setSnap(next);
    setDirty(true);
  }
  async function save() {
    if (!snap) return null;
    const next = await api<Snapshot>('/snapshot', 'PUT', snap);
    setSnap(next);
    setDirty(false);
    setConflict(false);
    await refresh();
    return next;
  }
  function accept(next: Snapshot) {
    setSnap(next);
    setDirty(false);
    void refresh();
  }
  const entry = snap?.entries.find((e) => e.id === selected);
  function moveEntry(direction: number) {
    update((s) => {
      const ordered = s.entries
        .filter((e) => e.type === entry!.type)
        .sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((e) => e.id === selected);
      const other = index + direction;
      if (other < 0 || other >= ordered.length) return;
      [ordered[index], ordered[other]] = [ordered[other], ordered[index]];
      ordered.forEach((e, i) => (e.order = i));
    });
  }
  function patchEntry(patch: Partial<Entry>) {
    update((s) => {
      const e = s.entries.find((e) => e.id === selected);
      if (e) Object.assign(e, patch);
    });
  }
  function patchTranslation(key: 'title' | 'summary' | 'body', value: string) {
    update((s) => {
      const e = s.entries.find((e) => e.id === selected);
      if (e) {
        e.translations[locale][key] = value;
        e.translations[locale].reviewed = false;
      }
    });
  }
  function newEntry(type: EntryType = 'post') {
    const id = uid();
    update((s) =>
      s.entries.push({
        id,
        type,
        slug: `${type}-${Date.now().toString(36)}`,
        status: 'draft',
        sourceLocale: 'zh-CN',
        translations: {
          'zh-CN': blankTranslation(),
          en: blankTranslation(),
          fr: blankTranslation(),
        },
        coverId: null,
        tags: [],
        featured: false,
        order: s.entries.length,
        date: new Date().toISOString().slice(0, 10),
        url: '',
        period: '',
      }),
    );
    setSelected(id);
    setTab('content');
    setLocale('zh-CN');
  }
  function insert(before: string, after = '') {
    if (!entry) return;
    const el = bodyRef.current;
    const text = entry.translations[locale].body,
      start = el?.selectionStart ?? text.length,
      end = el?.selectionEnd ?? start;
    patchTranslation(
      'body',
      text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end),
    );
    setPreview(false);
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(start + before.length, end + before.length);
    });
  }
  async function review(profile = false) {
    await run(async () => {
      if (dirty) await save();
      accept(
        await api<Snapshot>(
          '/review',
          'POST',
          profile ? { profile: true, locale } : { entryId: selected, locale },
        ),
      );
      setToast(t('success'));
    });
  }
  async function translate(profile = false) {
    if (!window.confirm(t('translateConfirm'))) return;
    await run(async () => {
      if (dirty) await save();
      accept(
        await api<Snapshot>(
          '/translate',
          'POST',
          profile
            ? { profile: true, targetLocale: locale, overwrite: true }
            : { entryId: selected, targetLocale: locale, overwrite: true },
        ),
      );
      setToast(t('success'));
    });
  }
  const languageTabs = (
    <div className="language-tabs" aria-label={t('contentLanguage')}>
      {LOCALES.map((l) => (
        <button key={l} className={locale === l ? 'active' : ''} onClick={() => setLocale(l)}>
          {localeLabels[l]}
        </button>
      ))}
    </div>
  );

  function reviewPanel(profile = false) {
    const current = profile ? snap!.settings.profile[locale] : entry!.translations[locale];
    const source = profile ? snap!.settings.sourceLocale : entry!.sourceLocale;
    const path = profile ? 'profile' : entry!.id;
    const stale = issues.some(
      (i) => i.path.startsWith(`${path}.${locale}`) && i.message.includes('out of date'),
    );
    return (
      <div className="review-panel">
        <div>
          <span className={`pill ${current.reviewed && !stale ? 'good' : 'warn'}`}>
            {stale ? t('stale') : current.reviewed ? t('reviewed') : t('needsReview')}
          </span>
          <p>{t('reviewHelp')}</p>
        </div>
        <div className="actions">
          <button
            disabled={busy || !translation.configured || source === locale}
            onClick={() => translate(profile)}
          >
            {t('translate')}
          </button>
          <button disabled={busy} onClick={() => review(profile)}>
            {t('review')}
          </button>
        </div>
      </div>
    );
  }
  function mediaSelect(value: string | null, onChange: (id: string | null) => void) {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t('none')}</option>
        {snap!.media.map((m) => (
          <option key={m.id} value={m.id}>
            {m.filename}
          </option>
        ))}
      </select>
    );
  }
  const errors = error && (
    <div className="alert error" role="alert">
      <span>{localizeServerMessage(error, ui)}</span>
      {conflict && (
        <button
          onClick={() => {
            if (!dirty || confirm(t('discard'))) void load();
          }}
        >
          {t('reload')}
        </button>
      )}
      <button className="icon-button" aria-label={t('close')} onClick={() => setError('')}>
        ×
      </button>
    </div>
  );
  if (!session)
    return (
      <main className="loading-screen">
        {errors}
        <p>{t('loading')}</p>
        {error && <button onClick={() => location.reload()}>{t('retry')}</button>}
      </main>
    );
  if (!session.authenticated)
    return (
      <main className="login-page">
        <CursorGlow />
        <div className="login-brand">
          F<span>·</span>
        </div>
        <section className="login-panel">
          <div className="eyebrow">FOLIO / STUDIO</div>
          <h1>{t('login')}</h1>
          <p>{t('loginIntro')}</p>
          {errors}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const result = await api<{
                  authenticated: boolean;
                  localDemo: boolean;
                  productionUrl?: string;
                }>('/login', 'POST', { password });
                setSession(result);
                setPassword('');
              });
            }}
          >
            <Field label={t('password')}>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <button className="primary" disabled={busy}>
              {busy ? t('loading') : t('login')} <span>↗</span>
            </button>
          </form>
          {session.localDemo && (
            <p className="demo-hint">
              {t('demoPassword')}: <code>local-demo-password</code>
            </p>
          )}
          <select
            aria-label={t('language')}
            value={ui}
            onChange={(e) => setUi(e.target.value as Locale)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {localeLabels[l]}
              </option>
            ))}
          </select>
        </section>
      </main>
    );
  if (!snap)
    return (
      <main className="loading-screen">
        {errors}
        <p>{t('loading')}</p>
        <button onClick={() => void load()}>{t('retry')}</button>
      </main>
    );
  const navs = ['dashboard', 'content', 'profile', 'appearance', 'media', 'releases'] as const;
  return (
    <div className="studio" style={{ '--accent': snap.settings.accent } as React.CSSProperties}>
      <CursorGlow
        accent={snap.settings.accent}
        radius={snap.settings.cursorGlowRadius ?? CURSOR_GLOW_RADIUS.default}
      />
      <aside className="sidebar">
        <a className="brand" href="/admin/">
          Folio<span> / studio</span>
        </a>
        <div className="workspace">
          <span className="avatar-mark">{snap.settings.profile[ui].name.slice(0, 1) || 'F'}</span>
          <div>
            <strong>{snap.settings.profile[ui].name || 'Folio'}</strong>
            <small>{t('passwordHint')}</small>
          </div>
        </div>
        <nav aria-label={t('studio')}>
          {navs.map((n, i) => (
            <button
              key={n}
              className={tab === n ? 'selected' : ''}
              onClick={() => {
                setTab(n);
                if (n !== 'content') setSelected(null);
              }}
            >
              <span className="nav-number">0{i + 1}</span>
              {t(n)}
              {n === 'releases' && issues.length > 0 && (
                <span className="nav-count">{issues.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <label>
            {t('language')}
            <select
              aria-label={t('language')}
              value={ui}
              onChange={(e) => setUi(e.target.value as Locale)}
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {localeLabels[l]}
                </option>
              ))}
            </select>
          </label>
          <a
            className="external"
            href={session.productionUrl || `${location.protocol}//${location.hostname}:4323/`}
            target="_blank"
            rel="noreferrer"
          >
            {t('visit')} ↗
          </a>
          <button
            className="text-button"
            onClick={() => {
              if (dirty && !confirm(t('discard'))) return;
              void run(async () => {
                await api('/logout', 'POST');
                setSession({ ...session, authenticated: false });
                setSnap(null);
              });
            }}
          >
            {t('logout')}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            STUDIO <b>/</b> {t(tab)}
          </span>
          <div className="save-area">
            <span className={`save-state ${dirty ? 'dirty' : ''}`}>
              <i />
              {dirty ? t('unsaved') : t('saved')}
            </span>
            <button
              className="primary"
              disabled={!dirty || busy}
              onClick={() =>
                void run(async () => {
                  await save();
                  setToast(t('saveSuccess'));
                })
              }
            >
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        </header>
        <main className="main-content">
          <fieldset className="editing-scope" disabled={busy} aria-busy={busy}>
            {errors}
            {toast && (
              <div className="toast" role="status">
                ✓ {toast}
              </div>
            )}
            {tab === 'dashboard' && (
              <>
                <div className="page-intro">
                  <div className="eyebrow">{t('overviewEyebrow')}</div>
                  <h1>{t('welcome')}</h1>
                  <p>{t('overviewIntro')}</p>
                </div>
                <div className="stats">
                  <div>
                    <span>{t('entries')}</span>
                    <strong>{snap.entries.length.toString().padStart(2, '0')}</strong>
                  </div>
                  <div>
                    <span>{t('published')}</span>
                    <strong>
                      {snap.entries
                        .filter((e) => e.status === 'published')
                        .length.toString()
                        .padStart(2, '0')}
                    </strong>
                  </div>
                  <div>
                    <span>{t('languages')}</span>
                    <strong>03</strong>
                  </div>
                  <div>
                    <span>{t('revision')}</span>
                    <strong>{snap.revision.toString().padStart(2, '0')}</strong>
                  </div>
                </div>
                <section className="next-step">
                  <div className="eyebrow">01 — {t('overviewNext')}</div>
                  <h2>{t('overviewHint')}</h2>
                  <p>{t('contentHint')}</p>
                  <div className="actions">
                    <button className="primary" onClick={() => newEntry('post')}>
                      {t('quickCreate')} ↗
                    </button>
                    <button onClick={() => setTab('releases')}>{t('releases')} →</button>
                  </div>
                  <span className="decorative-orbit" aria-hidden="true" />
                </section>
                <div className="section-heading">
                  <h2>{t('content')}</h2>
                  <button className="text-button" onClick={() => setTab('content')}>
                    {t('all')} →
                  </button>
                </div>
                <div className="entry-list">
                  {snap.entries.slice(0, 5).map((e) => (
                    <button
                      className="entry-row"
                      key={e.id}
                      onClick={() => {
                        setSelected(e.id);
                        setTab('content');
                      }}
                    >
                      <span className="entry-type">{t(e.type)}</span>
                      <strong>{e.translations[ui].title || e.slug}</strong>
                      <span className={`pill ${e.status === 'published' ? 'good' : ''}`}>
                        {t(e.status)}
                      </span>
                      <span>↗</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {tab === 'content' && !entry && (
              <>
                <div className="page-intro row">
                  <div>
                    <div className="eyebrow">{t('contentEyebrow')}</div>
                    <h1>{t('content')}</h1>
                    <p>{t('contentHint')}</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => newEntry(filter === 'all' ? 'post' : filter)}
                  >
                    ＋ {t('newEntry')}
                  </button>
                </div>
                <div className="filter-bar">
                  <div className="filter-tabs">
                    {(['all', 'project', 'post', 'page', 'experience'] as const).map((f) => (
                      <button
                        className={filter === f ? 'active' : ''}
                        key={f}
                        onClick={() => setFilter(f)}
                      >
                        {t(f)}
                      </button>
                    ))}
                  </div>
                  <input
                    type="search"
                    aria-label={t('search')}
                    placeholder={t('search')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="entry-list">
                  {snap.entries
                    .filter(
                      (e) =>
                        (filter === 'all' || e.type === filter) &&
                        `${Object.values(e.translations)
                          .map((x) => x.title)
                          .join(' ')} ${e.tags.join(' ')}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                    )
                    .sort((a, b) => a.order - b.order)
                    .map((e) => (
                      <div className="entry-row" key={e.id}>
                        <button
                          className="entry-main"
                          onClick={() => {
                            setSelected(e.id);
                            setLocale(e.sourceLocale);
                          }}
                        >
                          {e.coverId && (
                            <img src={snap.media.find((m) => m.id === e.coverId)?.path} alt="" />
                          )}
                          <div>
                            <span className="entry-type">{t(e.type)}</span>
                            <h3>
                              {e.translations[ui].title ||
                                e.translations[e.sourceLocale].title ||
                                e.slug}
                            </h3>
                            <small>
                              {e.date} · /{e.slug}
                            </small>
                          </div>
                        </button>
                        <div className="entry-languages">
                          {LOCALES.map((l) => (
                            <span
                              key={l}
                              title={localeLabels[l]}
                              className={e.translations[l].reviewed ? 'complete' : ''}
                            >
                              {l === 'zh-CN' ? '中' : l.toUpperCase()}
                            </span>
                          ))}
                        </div>
                        <span className={`pill ${e.status === 'published' ? 'good' : ''}`}>
                          {t(e.status)}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={t('edit')}
                          onClick={() => setSelected(e.id)}
                        >
                          ↗
                        </button>
                      </div>
                    ))}
                </div>
                {!snap.entries.some(
                  (e) =>
                    (filter === 'all' || e.type === filter) &&
                    `${Object.values(e.translations)
                      .map((x) => x.title)
                      .join(' ')} ${e.tags.join(' ')}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                ) && <p className="empty">{t('noMatch')}</p>}
              </>
            )}
            {tab === 'content' && entry && (
              <>
                <button className="text-button back" onClick={() => setSelected(null)}>
                  ← {t('back')}
                </button>
                <div className="page-intro row">
                  <div>
                    <div className="eyebrow">{t(entry.type)}</div>
                    <h1>{entry.translations[locale].title || t('newEntry')}</h1>
                  </div>
                  <span className="pill">{t(entry.status)}</span>
                </div>
                <div className="editor-layout">
                  <section className="editor-main">
                    {languageTabs}
                    <Field label={t('title')}>
                      <input
                        className="title-input"
                        value={entry.translations[locale].title}
                        onChange={(e) => patchTranslation('title', e.target.value)}
                      />
                    </Field>
                    <Field label={t('summary')}>
                      <textarea
                        rows={3}
                        value={entry.translations[locale].summary}
                        onChange={(e) => patchTranslation('summary', e.target.value)}
                      />
                    </Field>
                    <div className="body-label">
                      <span>{t('body')}</span>
                      <div className="segmented">
                        <button
                          className={!preview ? 'active' : ''}
                          onClick={() => setPreview(false)}
                        >
                          {t('editor')}
                        </button>
                        <button
                          className={preview ? 'active' : ''}
                          onClick={() => setPreview(true)}
                        >
                          {t('preview')}
                        </button>
                      </div>
                    </div>
                    <div className="markdown-editor">
                      <div className="toolbar">
                        <button
                          title={t('bold')}
                          aria-label={t('bold')}
                          onClick={() => insert('**', '**')}
                        >
                          <b>B</b>
                        </button>
                        <button
                          title={t('heading')}
                          aria-label={t('heading')}
                          onClick={() => insert('\n## ')}
                        >
                          H₂
                        </button>
                        <button
                          title={t('link')}
                          aria-label={t('link')}
                          onClick={() => insert('[', '](https://example.com)')}
                        >
                          ↗
                        </button>
                        <button
                          title={t('code')}
                          aria-label={t('code')}
                          onClick={() => insert('\n```\n', '\n```\n')}
                        >
                          {'</>'}
                        </button>
                        <button onClick={() => setImagePicker(true)}>▧ {t('insertImage')}</button>
                      </div>
                      {preview ? (
                        <Markdown text={entry.translations[locale].body} />
                      ) : (
                        <textarea
                          ref={bodyRef}
                          aria-label={t('body')}
                          className="body-editor"
                          value={entry.translations[locale].body}
                          onChange={(e) => patchTranslation('body', e.target.value)}
                          spellCheck
                        />
                      )}
                    </div>
                    <p className="hint">{t('markdownHelp')}</p>
                    {reviewPanel()}
                    <p className="hint">
                      {translation.configured
                        ? `${t('translationConfigured')} · ${translation.model}`
                        : t('translationUnconfigured')}
                    </p>
                  </section>
                  <aside className="entry-settings">
                    <h3>{t('meta')}</h3>
                    <Field label={t('filter')}>
                      <select
                        value={entry.type}
                        onChange={(e) => patchEntry({ type: e.target.value as EntryType })}
                      >
                        {(['post', 'project', 'page', 'experience'] as const).map((x) => (
                          <option key={x} value={x}>
                            {t(x)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('status')}>
                      <select
                        value={entry.status}
                        onChange={(e) => patchEntry({ status: e.target.value as Entry['status'] })}
                      >
                        <option value="draft">{t('draft')}</option>
                        <option value="published">{t('published')}</option>
                      </select>
                    </Field>
                    <Field label={t('slug')}>
                      <input
                        value={entry.slug}
                        onChange={(e) => patchEntry({ slug: e.target.value })}
                      />
                    </Field>
                    <Field label={t('source')}>
                      <select
                        value={entry.sourceLocale}
                        onChange={(e) => patchEntry({ sourceLocale: e.target.value as Locale })}
                      >
                        {LOCALES.map((l) => (
                          <option key={l} value={l}>
                            {localeLabels[l]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="hint">{t('sourceNote')}</p>
                    <Field label={t('date')}>
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(e) => patchEntry({ date: e.target.value })}
                      />
                    </Field>
                    <Field label={t('period')}>
                      <input
                        value={entry.period}
                        onChange={(e) => patchEntry({ period: e.target.value })}
                      />
                    </Field>
                    <Field label={t('url')}>
                      <input
                        type="url"
                        value={entry.url}
                        onChange={(e) => patchEntry({ url: e.target.value })}
                      />
                    </Field>
                    <Field label={t('tags')}>
                      <input
                        value={entry.tags.join(', ')}
                        onChange={(e) =>
                          patchEntry({ tags: e.target.value.split(',').map((x) => x.trim()) })
                        }
                      />
                    </Field>
                    <Field label={t('cover')}>
                      {mediaSelect(entry.coverId, (id) => patchEntry({ coverId: id }))}
                    </Field>
                    {entry.coverId && (
                      <img
                        className="cover-preview"
                        src={snap.media.find((m) => m.id === entry.coverId)?.path}
                        alt=""
                      />
                    )}
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={entry.featured}
                        onChange={(e) => patchEntry({ featured: e.target.checked })}
                      />
                      {t('featured')}
                    </label>
                    <div className="actions">
                      <button onClick={() => moveEntry(-1)}>{t('moveEarlier')}</button>
                      <button onClick={() => moveEntry(1)}>{t('moveLater')}</button>
                    </div>
                    <button
                      className="danger text-button"
                      onClick={() => {
                        if (confirm(t('deleteConfirm'))) {
                          update((s) => {
                            s.entries = s.entries.filter((e) => e.id !== entry.id);
                          });
                          setSelected(null);
                        }
                      }}
                    >
                      {t('deleteEntry')}
                    </button>
                  </aside>
                </div>
              </>
            )}
            {tab === 'profile' && (
              <>
                <div className="page-intro">
                  <div className="eyebrow">{t('profileEyebrow')}</div>
                  <h1>{t('profile')}</h1>
                  <p>{t('sourceNote')}</p>
                </div>
                {languageTabs}
                <div className="form-grid">
                  {(['name', 'headline', 'intro', 'about', 'seoDescription'] as const).map((k) => (
                    <Field key={k} label={t(k)} wide={k === 'about' || k === 'seoDescription'}>
                      {k === 'about' || k === 'intro' || k === 'seoDescription' ? (
                        <textarea
                          rows={k === 'about' ? 8 : 3}
                          value={snap.settings.profile[locale][k]}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.profile[locale][k] = e.target.value;
                              s.settings.profile[locale].reviewed = false;
                            })
                          }
                        />
                      ) : (
                        <input
                          value={snap.settings.profile[locale][k]}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.profile[locale][k] = e.target.value;
                              s.settings.profile[locale].reviewed = false;
                            })
                          }
                        />
                      )}
                    </Field>
                  ))}
                  <Field label={t('source')}>
                    <select
                      value={snap.settings.sourceLocale}
                      onChange={(e) =>
                        update((s) => {
                          s.settings.sourceLocale = e.target.value as Locale;
                        })
                      }
                    >
                      {LOCALES.map((l) => (
                        <option key={l} value={l}>
                          {localeLabels[l]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('avatar')}>
                    {mediaSelect(snap.settings.avatarId, (id) =>
                      update((s) => {
                        s.settings.avatarId = id;
                      }),
                    )}
                  </Field>
                  <Field label={t('resume')}>
                    <input
                      type="url"
                      value={snap.settings.resumeUrl}
                      onChange={(e) =>
                        update((s) => {
                          s.settings.resumeUrl = e.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field label={t('siteUrl')}>
                    <input
                      type="url"
                      value={snap.settings.siteUrl}
                      onChange={(e) =>
                        update((s) => {
                          s.settings.siteUrl = e.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field label={t('defaultLocale')}>
                    <select
                      value={snap.settings.defaultLocale}
                      onChange={(e) =>
                        update((s) => {
                          s.settings.defaultLocale = e.target.value as Locale;
                        })
                      }
                    >
                      {LOCALES.map((l) => (
                        <option key={l} value={l}>
                          {localeLabels[l]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {reviewPanel(true)}
                <p className="hint">
                  {translation.configured
                    ? t('translationConfigured')
                    : t('translationUnconfigured')}
                </p>
              </>
            )}
            {tab === 'appearance' && (
              <>
                <div className="page-intro">
                  <div className="eyebrow">{t('appearanceEyebrow')}</div>
                  <h1>{t('appearance')}</h1>
                </div>
                <section className="settings-section">
                  <h2>{t('theme')}</h2>
                  <p>{t('themeHelp')}</p>
                  <div className="theme-presets">
                    {(
                      [
                        { label: 'mint', accent: '#5eead4', background: '#0f172a' },
                        { label: 'violet', accent: '#c4b5fd', background: '#19152b' },
                        { label: 'amber', accent: '#fcd34d', background: '#1c1917' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.label}
                        className={snap.settings.accent === p.accent ? 'chosen' : ''}
                        style={{ background: p.background, color: p.accent }}
                        onClick={() =>
                          update((s) => {
                            s.settings.accent = p.accent;
                            s.settings.background = p.background;
                          })
                        }
                      >
                        <span className="palette-dot" style={{ background: p.accent }} />
                        <span>{t(p.label)}</span>
                        <span>↗</span>
                      </button>
                    ))}
                  </div>
                  <div className="form-grid">
                    <Field label={t('accent')}>
                      <div className="color-input">
                        <input
                          type="color"
                          value={snap.settings.accent}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.accent = e.target.value;
                            })
                          }
                        />
                        <input
                          aria-label={t('accent')}
                          value={snap.settings.accent}
                          maxLength={7}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.accent = e.target.value;
                            })
                          }
                        />
                      </div>
                    </Field>
                    <Field label={t('background')}>
                      <div className="color-input">
                        <input
                          type="color"
                          value={snap.settings.background}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.background = e.target.value;
                            })
                          }
                        />
                        <input
                          aria-label={t('background')}
                          value={snap.settings.background}
                          maxLength={7}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.background = e.target.value;
                            })
                          }
                        />
                      </div>
                    </Field>
                  </div>
                </section>
                <CursorGlowSettings
                  radius={snap.settings.cursorGlowRadius ?? CURSOR_GLOW_RADIUS.default}
                  t={t}
                  onChange={(radius) =>
                    update((s) => {
                      s.settings.cursorGlowRadius = radius;
                    })
                  }
                />
                <section className="settings-section">
                  <h2>{t('sections')}</h2>
                  <p>{t('sectionHelp')}</p>
                  {snap.settings.sections.map((section, i) => (
                    <div className="section-row" key={section.id}>
                      <span className="nav-number">0{i + 1}</span>
                      <strong>{t(section.id)}</strong>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={section.enabled}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.sections[i].enabled = e.target.checked;
                            })
                          }
                        />
                        {t('enabled')}
                      </label>
                      <button
                        className="icon-button"
                        aria-label={`${t('up')} ${t(section.id)}`}
                        disabled={i === 0}
                        onClick={() =>
                          update((s) => {
                            [s.settings.sections[i - 1], s.settings.sections[i]] = [
                              s.settings.sections[i],
                              s.settings.sections[i - 1],
                            ];
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`${t('down')} ${t(section.id)}`}
                        disabled={i === snap.settings.sections.length - 1}
                        onClick={() =>
                          update((s) => {
                            [s.settings.sections[i + 1], s.settings.sections[i]] = [
                              s.settings.sections[i],
                              s.settings.sections[i + 1],
                            ];
                          })
                        }
                      >
                        ↓
                      </button>
                    </div>
                  ))}
                </section>
                <section className="settings-section">
                  <div className="section-heading">
                    <h2>{t('socials')}</h2>
                    <button
                      onClick={() =>
                        update((s) =>
                          s.settings.socials.push({
                            id: uid(),
                            label: '',
                            url: 'https://',
                            icon: 'link',
                          }),
                        )
                      }
                    >
                      ＋ {t('addSocial')}
                    </button>
                  </div>
                  {snap.settings.socials.map((social, i) => (
                    <div className="social-row" key={social.id}>
                      <Field label={t('label')}>
                        <input
                          value={social.label}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.socials[i].label = e.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field label={t('url')}>
                        <input
                          type="url"
                          value={social.url}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.socials[i].url = e.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field label={t('icon')}>
                        <select
                          value={social.icon}
                          onChange={(e) =>
                            update((s) => {
                              s.settings.socials[i].icon = e.target.value;
                            })
                          }
                        >
                          {['github', 'linkedin', 'email', 'x', 'bilibili', 'youtube', 'link'].map(
                            (x) => (
                              <option key={x}>{x}</option>
                            ),
                          )}
                        </select>
                      </Field>
                      <button
                        className="icon-button"
                        aria-label={t('up')}
                        disabled={i === 0}
                        onClick={() =>
                          update((s) => {
                            [s.settings.socials[i - 1], s.settings.socials[i]] = [
                              s.settings.socials[i],
                              s.settings.socials[i - 1],
                            ];
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={t('delete')}
                        onClick={() => {
                          if (confirm(t('deleteConfirm')))
                            update((s) => {
                              s.settings.socials.splice(i, 1);
                            });
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </section>
              </>
            )}
            {tab === 'media' && (
              <>
                <div className="page-intro row">
                  <div>
                    <div className="eyebrow">{t('mediaEyebrow')}</div>
                    <h1>{t('media')}</h1>
                    <p>{t('mediaHelp')}</p>
                  </div>
                  <label className={`button primary ${busy ? 'disabled' : ''}`}>
                    ＋ {t('upload')}
                    <input
                      className="visually-hidden"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f)
                          void run(async () => {
                            if (dirty) await save();
                            const fd = new FormData();
                            fd.append('image', f);
                            accept(
                              (await api<{ snapshot: Snapshot }>('/media', 'POST', fd)).snapshot,
                            );
                            setToast(t('success'));
                          });
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {languageTabs}
                <div className="media-grid">
                  {snap.media.map((m) => {
                    const refs = snap.entries.filter(
                      (e) =>
                        e.coverId === m.id ||
                        Object.values(e.translations).some((tr) => tr.body.includes(m.path)),
                    );
                    return (
                      <article className="media-item" key={m.id}>
                        <div className="media-image">
                          <img src={m.path} alt={m.alt[locale]} />
                        </div>
                        <div className="media-details">
                          <h3>{m.filename}</h3>
                          <small>
                            {m.width} × {m.height}
                          </small>
                          <Field label={`${t('alt')} · ${localeLabels[locale]}`}>
                            <input
                              value={m.alt[locale]}
                              onChange={(e) =>
                                update((s) => {
                                  s.media.find((x) => x.id === m.id)!.alt[locale] = e.target.value;
                                })
                              }
                            />
                          </Field>
                          <Field label={t('caption')}>
                            <input
                              value={m.caption[locale]}
                              onChange={(e) =>
                                update((s) => {
                                  s.media.find((x) => x.id === m.id)!.caption[locale] =
                                    e.target.value;
                                })
                              }
                            />
                          </Field>
                          <p className="hint">
                            {t('references')}:{' '}
                            {snap.settings.avatarId === m.id ? `${t('avatar')} · ` : ''}
                            {refs.map((e) => e.translations[ui].title || e.slug).join(', ') ||
                              (snap.settings.avatarId !== m.id ? t('unreferenced') : '')}
                          </p>
                          <div className="actions">
                            <button
                              onClick={() =>
                                void run(async () => {
                                  await navigator.clipboard.writeText(m.path);
                                  setToast(t('copied'));
                                })
                              }
                            >
                              {t('copyPath')}
                            </button>
                            <button
                              className="danger"
                              disabled={busy}
                              onClick={() => {
                                if (confirm(t('mediaDeleteConfirm')))
                                  void run(async () => {
                                    if (dirty) await save();
                                    accept(await api<Snapshot>(`/media/${m.id}`, 'DELETE'));
                                  });
                              }}
                            >
                              {t('delete')}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {snap.media.length === 0 && <p className="empty">{t('noMedia')}</p>}
              </>
            )}
            {tab === 'releases' && (
              <>
                <div className="page-intro">
                  <div className="eyebrow">{t('releasesEyebrow')}</div>
                  <h1>{t('releases')}</h1>
                  <p>{t('releaseIntro')}</p>
                </div>
                <section className="release-create">
                  <div>
                    <h2>{t('build')}</h2>
                    <p>{t('buildHelp')}</p>
                    <span className="hint">
                      {t('previewPrivate')} · {t('exported')}
                    </span>
                  </div>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      dirty ||
                      issues.length > 0 ||
                      releaseData.releases.some((r) => r.status === 'building')
                    }
                    onClick={() =>
                      void run(async () => {
                        await api('/releases', 'POST');
                        await refresh();
                      })
                    }
                  >
                    {releaseData.releases.some((r) => r.status === 'building')
                      ? t('building')
                      : t('build')}{' '}
                    ↗
                  </button>
                </section>
                {dirty && <div className="alert">{t('saveFirst')}</div>}
                <section className="validation-panel">
                  <div className="section-heading">
                    <h3>{t('validation')}</h3>
                    <span className={`pill ${issues.length ? 'warn' : 'good'}`}>
                      {issues.length ? `${issues.length} ${t('issues')}` : t('ready')}
                    </span>
                  </div>
                  {issues.length > 0 && (
                    <ul>
                      {issues.map((i, k) => (
                        <li key={k}>
                          <code>{i.path}</code>
                          <span>{localizeServerMessage(i.message, ui)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <div className="section-heading">
                  <h2>{t('releaseHistory')}</h2>
                  <span className="hint">{t('releaseNotice')}</span>
                </div>
                <div className="release-list">
                  {releaseData.releases.map((r) => (
                    <article className="release-row" key={r.id}>
                      <div className={`release-dot ${r.status}`} />
                      <div className="release-info">
                        <h3>
                          {t('version')} {r.id}
                        </h3>
                        <p>
                          {new Intl.DateTimeFormat(ui, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(r.createdAt))}{' '}
                          · {t('revision')} {r.revision}
                        </p>
                        {r.error && <pre className="release-error">{r.error}</pre>}
                      </div>
                      <span
                        className={`pill ${releaseData.currentId === r.id ? 'good' : r.status === 'failed' ? 'warn' : ''}`}
                      >
                        {releaseData.currentId === r.id
                          ? t('live')
                          : r.status === 'ready'
                            ? t('releaseReady')
                            : r.status === 'published'
                              ? t('published')
                              : t(r.status)}
                      </span>
                      <div className="actions">
                        {(r.status === 'ready' || r.status === 'published') && (
                          <>
                            <a
                              className="button"
                              href={r.previewUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('openPreview')} ↗
                            </a>
                            {releaseData.currentId !== r.id && (
                              <button
                                className="primary"
                                disabled={busy || !r.previewedAt}
                                title={!r.previewedAt ? t('previewBeforePublish') : undefined}
                                onClick={() => {
                                  if (r.publishedAt && !confirm(t('rollbackConfirm'))) return;
                                  void run(async () => {
                                    await api(
                                      `/releases/${r.id}/${r.publishedAt ? 'rollback' : 'publish'}`,
                                      'POST',
                                    );
                                    await refresh();
                                    setToast(t('publishedSuccess'));
                                  });
                                }}
                              >
                                {r.publishedAt ? t('rollback') : t('publish')}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {releaseData.releases.length === 0 && <p className="empty">{t('noReleases')}</p>}
              </>
            )}
          </fieldset>
        </main>
        <footer className="studio-footer">
          <span>FOLIO STUDIO</span>
          <span>{t('subtitle')}</span>
          <span>zh-CN / en / fr</span>
        </footer>
      </div>
      {imagePicker && (
        <div className="modal-backdrop" role="presentation" onClick={() => setImagePicker(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('selectImage')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <h2>{t('selectImage')}</h2>
              <button
                className="icon-button"
                aria-label={t('close')}
                onClick={() => setImagePicker(false)}
              >
                ×
              </button>
            </div>
            <div className="image-picker">
              {snap.media.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    insert(
                      `\n![${m.alt[locale]}](${m.path})\n${m.caption[locale] ? `\n*${m.caption[locale]}*\n` : ''}`,
                    );
                    setImagePicker(false);
                  }}
                >
                  <img src={m.path} alt={m.alt[locale]} />
                  <span>{m.filename}</span>
                </button>
              ))}
            </div>
            {!snap.media.length && <p>{t('noMedia')}</p>}
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
