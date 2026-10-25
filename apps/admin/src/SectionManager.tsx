import { useState, type ReactNode } from 'react';
import { LOCALES, type Entry, type HomeSection, type Locale } from '../../../shared/types';
import { BUILTIN_SECTION_IDS, isBuiltinSection, sectionTitle } from '../../../shared/sections';
import { localeLabels, type MessageKey } from './i18n';

interface Props {
  sections: HomeSection[];
  entries: Entry[];
  ui: Locale;
  t: (key: MessageKey) => string;
  onChange: (sections: HomeSection[]) => void;
  onOpenContent: (target: 'profile' | 'content') => void;
  renderTranslation: (sectionId: string, targetLocale: Locale) => ReactNode;
}
const emptyLanguages = (): Record<Locale, string> => ({ 'zh-CN': '', en: '', fr: '' });

export function SectionManager({
  sections,
  entries,
  ui,
  t,
  onChange,
  onOpenContent,
  renderTranslation,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(ui);
  const [query, setQuery] = useState('');
  const [restoreId, setRestoreId] = useState('');
  const removed = BUILTIN_SECTION_IDS.filter(
    (id) => !sections.some((section) => section.id === id),
  );
  const restoreChoice = removed.find((id) => id === restoreId) ?? removed[0] ?? '';
  const full = sections.length >= 30;
  function patch(id: string, value: Partial<HomeSection>) {
    onChange(sections.map((section) => (section.id === id ? { ...section, ...value } : section)));
  }
  function move(id: string, direction: number) {
    const index = sections.findIndex((section) => section.id === id);
    const next = [...sections];
    if (index < 0 || index + direction < 0 || index + direction >= next.length) return;
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  }
  function changeTitle(section: HomeSection, value: string) {
    const titles =
      section.titles ??
      (Object.fromEntries(
        LOCALES.map((language) => [
          language,
          isBuiltinSection(section.id) ? sectionTitle(section, language) : '',
        ]),
      ) as Record<Locale, string>);
    patch(section.id, { titles: { ...titles, [locale]: value } });
  }
  function open(id: string) {
    setExpanded(expanded === id ? null : id);
    setQuery('');
  }
  return (
    <section className="settings-section section-manager" aria-labelledby="section-manager-title">
      <div className="section-heading">
        <h2 id="section-manager-title">{t('sections')}</h2>
        <button
          type="button"
          disabled={full}
          onClick={() => {
            const id = `section-${crypto.randomUUID()}`;
            onChange([
              ...sections,
              { id, enabled: true, titles: emptyLanguages(), body: emptyLanguages(), entryIds: [] },
            ]);
            setExpanded(id);
            setLocale(ui);
            setQuery('');
          }}
        >
          + {t('newSection')}
        </button>
      </div>
      <p>{t('sectionHelp')}</p>
      {full && (
        <p className="hint" role="status">
          {t('sectionLimit')}
        </p>
      )}
      {sections.length === 0 && <p className="empty-state">{t('noSections')}</p>}
      <div className="section-editor-list">
        {sections.map((section, index) => {
          const builtin = isBuiltinSection(section.id);
          const title = sectionTitle(section, ui) || t('untitledSection');
          const selected = section.entryIds ?? [];
          const candidates = entries.filter((entry) =>
            `${entry.translations[locale].title} ${entry.type} ${entry.tags.join(' ')}`
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
          );
          return (
            <div className="section-editor" key={section.id} data-section-id={section.id}>
              <div className="section-editor__header">
                <button
                  type="button"
                  className="text-button section-editor__toggle"
                  aria-label={`${t('editSection')} ${title}`}
                  aria-expanded={expanded === section.id}
                  aria-controls={`editor-${section.id}`}
                  onClick={() => open(section.id)}
                >
                  <span aria-hidden="true">{expanded === section.id ? '−' : '+'}</span>
                  <strong>{title}</strong>
                  <span className="section-editor__kind">
                    {t(builtin ? 'builtInSection' : 'customSection')}
                  </span>
                </button>
                <div className="section-editor__actions">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={(event) => patch(section.id, { enabled: event.target.checked })}
                    />
                    {t('enabled')}
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${t('up')} ${title}`}
                    disabled={index === 0}
                    onClick={() => move(section.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${t('down')} ${title}`}
                    disabled={index === sections.length - 1}
                    onClick={() => move(section.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-button danger"
                    aria-label={`${t('deleteSection')} ${title}`}
                    onClick={() => {
                      if (!window.confirm(t('deleteSectionConfirm'))) return;
                      onChange(sections.filter((item) => item.id !== section.id));
                      if (expanded === section.id) setExpanded(null);
                    }}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
              {expanded === section.id && (
                <div className="section-editor__body" id={`editor-${section.id}`}>
                  <label className="field section-editor__locale">
                    <span>{t('sectionLanguage')}</span>
                    <select
                      value={locale}
                      onChange={(event) => setLocale(event.target.value as Locale)}
                    >
                      {LOCALES.map((language) => (
                        <option key={language} value={language}>
                          {localeLabels[language]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t('sectionTitle')}</span>
                    <input
                      className="section-title-input"
                      type="text"
                      maxLength={120}
                      value={
                        section.titles?.[locale] ?? (builtin ? sectionTitle(section, locale) : '')
                      }
                      onChange={(event) => changeTitle(section, event.target.value)}
                    />
                  </label>
                  {renderTranslation(section.id, locale)}
                  {builtin ? (
                    <div className="section-editor__builtin-help">
                      <p className="hint">
                        {t(section.id === 'about' ? 'sectionAboutHelp' : 'sectionBuiltinHelp')}
                      </p>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          onOpenContent(section.id === 'about' ? 'profile' : 'content')
                        }
                      >
                        {t(section.id === 'about' ? 'profile' : 'content')} →
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="field">
                        <span>{t('sectionBody')}</span>
                        <textarea
                          className="section-body-input"
                          rows={7}
                          maxLength={50000}
                          value={section.body?.[locale] ?? ''}
                          onChange={(event) =>
                            patch(section.id, {
                              body: {
                                ...(section.body ?? emptyLanguages()),
                                [locale]: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <p className="hint">{t('sectionContentHelp')}</p>
                      <fieldset className="section-card-picker">
                        <legend>{t('sectionCards')}</legend>
                        <p className="hint">{t('sectionCardsHelp')}</p>
                        <label className="field">
                          <span>{t('sectionEntrySearch')}</span>
                          <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                          />
                        </label>
                        <div className="section-card-options">
                          {candidates.map((entry) => (
                            <label className="section-card-option" key={entry.id}>
                              <input
                                type="checkbox"
                                checked={selected.includes(entry.id)}
                                disabled={!selected.includes(entry.id) && selected.length >= 100}
                                onChange={(event) =>
                                  patch(section.id, {
                                    entryIds: event.target.checked
                                      ? [...selected, entry.id]
                                      : selected.filter((id) => id !== entry.id),
                                  })
                                }
                              />
                              <span>
                                {entry.translations[locale].title || entry.slug}
                                <small>
                                  {t(entry.type)} ·{' '}
                                  {t(entry.status === 'published' ? 'sectionEntryReady' : 'draft')}
                                </small>
                              </span>
                            </label>
                          ))}
                          {candidates.length === 0 && (
                            <p className="hint">{t('sectionNoEntries')}</p>
                          )}
                        </div>
                        {selected.length > 0 && (
                          <div className="section-selected-cards">
                            <p className="hint">{t('sectionCardOrder')}</p>
                            {selected.map((id, cardIndex) => {
                              const entry = entries.find((item) => item.id === id);
                              const name =
                                entry?.translations[locale].title ||
                                entry?.slug ||
                                t('sectionMissingEntry');
                              const moveCard = (direction: number) => {
                                const next = [...selected];
                                [next[cardIndex], next[cardIndex + direction]] = [
                                  next[cardIndex + direction],
                                  next[cardIndex],
                                ];
                                patch(section.id, { entryIds: next });
                              };
                              return (
                                <div className="section-selected-card" key={id}>
                                  <span>{name}</span>
                                  <button
                                    type="button"
                                    className="icon-button"
                                    aria-label={`${t('up')} ${name}`}
                                    disabled={cardIndex === 0}
                                    onClick={() => moveCard(-1)}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-button"
                                    aria-label={`${t('down')} ${name}`}
                                    disabled={cardIndex === selected.length - 1}
                                    onClick={() => moveCard(1)}
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    className="text-button"
                                    aria-label={`${t('removeSectionCard')} ${name}`}
                                    onClick={() =>
                                      patch(section.id, {
                                        entryIds: selected.filter((value) => value !== id),
                                      })
                                    }
                                  >
                                    {t('removeSectionCard')}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </fieldset>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onOpenContent('content')}
                      >
                        {t('manageSectionContent')} →
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {removed.length > 0 && (
        <div className="section-restore">
          <label className="field">
            <span>{t('restoreSection')}</span>
            <select value={restoreChoice} onChange={(event) => setRestoreId(event.target.value)}>
              {removed.map((id) => (
                <option key={id} value={id}>
                  {sectionTitle({ id, enabled: true }, ui)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={full}
            onClick={() => {
              if (!restoreChoice) return;
              onChange([...sections, { id: restoreChoice, enabled: true }]);
              setExpanded(restoreChoice);
            }}
          >
            {t('restoreSectionButton')}
          </button>
        </div>
      )}
    </section>
  );
}
