import { createHash } from 'node:crypto';
import { referencedMediaIds, missingMediaReferences } from './media-references.ts';
import { isBuiltinSection } from './sections.ts';
import {
  LOCALES,
  type Snapshot,
  type LocalizedContent,
  type Profile,
  type ValidationIssue,
} from './types.ts';
export function contentHash(value: LocalizedContent | Profile): string {
  const { reviewed, sourceHash, ...content } = value;
  return createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 20);
}
export function validateSnapshot(s: Snapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const p = s.settings.profile;
  const ph = contentHash(p[s.settings.sourceLocale]);
  for (const l of LOCALES) {
    for (const key of ['name', 'headline', 'intro', 'about', 'seoDescription'] as const)
      if (!p[l][key]?.trim()) add(`profile.${l}.${key}`, 'Required translation is missing');
    if (!p[l].reviewed) add(`profile.${l}`, 'Translation needs review');
    if (l !== s.settings.sourceLocale && p[l].sourceHash !== ph)
      add(`profile.${l}`, 'Translation is out of date');
  }
  const slugs = new Set<string>();
  for (const e of s.entries.filter((e) => e.status === 'published')) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.slug))
      add(e.id, 'Slug must contain lowercase letters, numbers and hyphens');
    const route = `${e.type}/${e.slug}`;
    if (slugs.has(route)) add(e.id, 'Duplicate slug');
    slugs.add(route);
    const hash = contentHash(e.translations[e.sourceLocale]);
    for (const l of LOCALES) {
      const t = e.translations[l];
      for (const k of ['title', 'summary', 'body'] as const)
        if (!t[k]?.trim()) add(`${e.id}.${l}.${k}`, 'Required translation is missing');
      if (!t.reviewed) add(`${e.id}.${l}`, 'Translation needs review');
      if (l !== e.sourceLocale && t.sourceHash !== hash)
        add(`${e.id}.${l}`, 'Translation is out of date');
    }
  }
  const entriesById = new Map(s.entries.map((entry) => [entry.id, entry]));
  for (const section of s.settings.sections.filter((section) => section.enabled)) {
    const path = `sections.${section.id}`;
    const builtin = isBuiltinSection(section.id);
    const hasCustomTitle = Object.values(section.titles ?? {}).some((title) => title.trim());
    if (!builtin || hasCustomTitle)
      for (const locale of LOCALES)
        if (!section.titles?.[locale]?.trim())
          add(`${path}.titles.${locale}`, 'Required translation is missing');
    if (builtin) continue;
    const hasBody = Object.values(section.body ?? {}).some((body) => body.trim());
    if (hasBody)
      for (const locale of LOCALES)
        if (!section.body?.[locale]?.trim())
          add(`${path}.body.${locale}`, 'Required translation is missing');
    let hasPublishedEntry = false;
    for (const id of section.entryIds ?? []) {
      const entry = entriesById.get(id);
      if (!entry) add(`${path}.entryIds.${id}`, 'Selected section entry is missing');
      else if (entry.status === 'published') hasPublishedEntry = true;
    }
    if (!hasBody && !hasPublishedEntry)
      add(path, 'Add section text or select at least one published entry');
  }
  const referenced = referencedMediaIds(s);
  for (const reference of missingMediaReferences(s))
    add(`media.${reference}`, 'Referenced image is missing');
  for (const m of s.media.filter((m) => referenced.has(m.id)))
    for (const l of LOCALES)
      if (!m.alt[l]?.trim()) add(`media.${m.id}.${l}`, 'Image alternative text is missing');
  return issues;
}
