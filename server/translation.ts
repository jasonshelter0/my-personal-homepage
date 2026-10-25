import { z } from 'zod';
import {
  type Locale,
  type LocalizedContent,
  type Profile,
  type Snapshot,
  type TranslationProvider,
} from '../shared/types.ts';
import { LOCALES } from '../shared/types.ts';
import { isBuiltinSection, sectionTitle } from '../shared/sections.ts';
import { contentHash } from '../shared/validation.ts';
import { getSnapshot, saveSnapshot, HttpError } from './store.ts';
import { localeSchema } from './schema.ts';
import { translationStatus, translateProse, translateOpenAI } from './translation-providers.ts';
export { translationStatus } from './translation-providers.ts';
const requestSchema = z
  .object({
    entryId: z.string().min(1).max(100).optional(),
    profile: z.literal(true).optional(),
    mediaId: z.string().min(1).max(100).optional(),
    sectionId: z.string().min(1).max(100).optional(),
    sourceLocale: localeSchema.optional(),
    targetLocale: localeSchema,
    overwrite: z.boolean().optional(),
    provider: z.enum(['mymemory', 'libretranslate', 'openai']).optional(),
  })
  .strict()
  .refine(
    (v) => [v.entryId, v.profile, v.mediaId, v.sectionId].filter(Boolean).length === 1,
    'Choose exactly one entry, profile, image or section.',
  )
  .refine(
    (v) => !v.sourceLocale || Boolean(v.mediaId || v.sectionId),
    'Source language can only be selected for images or sections.',
  );
const reviewSchema = z
  .object({
    entryId: z.string().max(100).optional(),
    profile: z.literal(true).optional(),
    locale: localeSchema,
  })
  .strict()
  .refine((v) => Boolean(v.entryId) !== Boolean(v.profile), 'Choose an entry or profile.');
function target(snapshot: Snapshot, input: { entryId?: string; profile?: true }) {
  if (input.profile)
    return {
      sourceLocale: snapshot.settings.sourceLocale,
      values: snapshot.settings.profile,
      keys: ['name', 'headline', 'intro', 'about', 'seoDescription'],
    };
  const entry = snapshot.entries.find((e) => e.id === input.entryId);
  if (!entry) throw new HttpError(404, 'Entry not found.');
  return {
    sourceLocale: entry.sourceLocale,
    values: entry.translations,
    keys: ['title', 'summary', 'body'],
  };
}
function preserveTokens(value: string): string[] {
  const code = [...value.matchAll(/```[\s\S]*?```|`[^`\n]+`/g)].map((m) => m[0]);
  const links = [...value.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
  const urls = [...value.matchAll(/https?:\/\/[^\s<>"'`\)\]]+/g)].map((m) => m[0]);
  return [...code, ...links, ...urls].sort();
}
async function translateFields(
  source: Record<string, string>,
  sourceLocale: Locale,
  targetLocale: Locale,
  provider: TranslationProvider,
  limits: Record<string, number>,
): Promise<Record<string, string>> {
  const payload =
    provider === 'openai'
      ? await translateOpenAI(source, sourceLocale, targetLocale)
      : await translateProse(source, sourceLocale, targetLocale, provider);
  const shape = Object.fromEntries(
    Object.keys(source).map((key) => [
      key,
      z
        .string()
        .min(1)
        .max(limits[key])
        .refine((value) => Boolean(value.trim())),
    ]),
  );
  const parsed = z.object(shape).strict().safeParse(payload);
  if (!parsed.success)
    throw new HttpError(502, 'Translation response has missing or invalid fields.');
  for (const key of Object.keys(source))
    if (
      JSON.stringify(preserveTokens(source[key])) !==
      JSON.stringify(preserveTokens(parsed.data[key]))
    )
      throw new HttpError(
        502,
        'Translation changed a link or code fragment. Your draft has not changed.',
      );
  return parsed.data;
}

async function translateMetadata(
  snapshot: Snapshot,
  request: z.infer<typeof requestSchema>,
  provider: TranslationProvider,
): Promise<Snapshot> {
  const sourceLocale = request.sourceLocale ?? snapshot.settings.sourceLocale;
  const targetLocale = request.targetLocale;
  if (sourceLocale === targetLocale)
    throw new HttpError(400, 'Choose a different target language.');
  let source: Record<string, string>, existing: Record<string, string>;
  let limits: Record<string, number>, apply: (translated: Record<string, string>) => void;
  const emptyLocalized = () => ({ 'zh-CN': '', en: '', fr: '' });
  if (request.mediaId) {
    const media = snapshot.media.find((item) => item.id === request.mediaId);
    if (!media) throw new HttpError(404, 'Image not found.');
    source = { alt: media.alt[sourceLocale], caption: media.caption[sourceLocale] };
    existing = { alt: media.alt[targetLocale], caption: media.caption[targetLocale] };
    limits = { alt: 1000, caption: 5000 };
    apply = (translated) => {
      media.alt[targetLocale] = translated.alt;
      media.caption[targetLocale] = translated.caption;
    };
  } else {
    const section = snapshot.settings.sections.find((item) => item.id === request.sectionId);
    if (!section) throw new HttpError(404, 'Section not found.');
    const builtin = isBuiltinSection(section.id);
    source = {
      title: builtin ? sectionTitle(section, sourceLocale) : (section.titles?.[sourceLocale] ?? ''),
      ...(!builtin ? { body: section.body?.[sourceLocale] ?? '' } : {}),
    };
    existing = {
      title: builtin ? sectionTitle(section, targetLocale) : (section.titles?.[targetLocale] ?? ''),
      ...(!builtin ? { body: section.body?.[targetLocale] ?? '' } : {}),
    };
    limits = { title: 120, body: 50000 };
    apply = (translated) => {
      section.titles ??= builtin
        ? (Object.fromEntries(
            LOCALES.map((locale) => [locale, sectionTitle(section, locale)]),
          ) as Record<Locale, string>)
        : emptyLocalized();
      section.titles[targetLocale] = translated.title;
      if (!builtin && (section.body || translated.body)) {
        section.body ??= emptyLocalized();
        section.body[targetLocale] = translated.body;
      }
    };
  }
  const nonempty = Object.fromEntries(Object.entries(source).filter(([, value]) => value.trim()));
  if (!Object.keys(nonempty).length)
    throw new HttpError(400, 'Add source text before translating.');
  if (!request.overwrite && Object.values(existing).some((value) => value.trim()))
    throw new HttpError(409, 'This language already contains text. Confirm overwrite explicitly.');
  const translated = await translateFields(nonempty, sourceLocale, targetLocale, provider, limits);
  if (getSnapshot().revision !== snapshot.revision)
    throw new HttpError(409, 'The draft changed while translating. Please retry.');
  // Empty optional fields are never sent to the provider, so it cannot invent captions or bodies.
  apply({ ...Object.fromEntries(Object.keys(source).map((key) => [key, ''])), ...translated });
  return saveSnapshot(snapshot);
}
export async function translate(input: unknown): Promise<Snapshot> {
  const request = requestSchema.parse(input);
  const status = translationStatus();
  const provider = request.provider || status.defaultProvider;
  if (!status.providers.find((item) => item.id === provider)?.configured)
    throw new HttpError(503, 'The selected translation provider is not configured.');
  const snapshot = getSnapshot();
  if (request.mediaId || request.sectionId) return translateMetadata(snapshot, request, provider);
  const item = target(snapshot, request);
  if (item.sourceLocale === request.targetLocale)
    throw new HttpError(400, 'Choose a different target language.');
  const existing = item.values[request.targetLocale];
  if (existing.reviewed && !request.overwrite)
    throw new HttpError(409, 'This translation was reviewed. Confirm overwrite explicitly.');
  const original = item.values[item.sourceLocale],
    source = Object.fromEntries(
      item.keys.map((k) => [k, (original as unknown as Record<string, string>)[k]]),
    );
  const limits: Record<string, number> = {
    title: 500,
    summary: 5000,
    body: 200000,
    name: 500,
    headline: 500,
    intro: 5000,
    about: 50000,
    seoDescription: 1000,
  };
  const translatedFields = await translateFields(
    source,
    item.sourceLocale,
    request.targetLocale,
    provider,
    limits,
  );
  const current = getSnapshot();
  if (current.revision !== snapshot.revision)
    throw new HttpError(409, 'The draft changed while translating. Please retry.');
  const translated = { ...translatedFields, reviewed: false, sourceHash: contentHash(original) };
  (item.values as unknown as Record<Locale, LocalizedContent | Profile>)[request.targetLocale] =
    translated as unknown as LocalizedContent | Profile;
  return saveSnapshot(snapshot);
}
export function review(input: unknown): Snapshot {
  const request = reviewSchema.parse(input),
    snapshot = getSnapshot(),
    item = target(snapshot, request),
    value = item.values[request.locale];
  for (const k of item.keys)
    if (!(value as unknown as Record<string, string>)[k]?.trim())
      throw new HttpError(400, 'Complete all fields before marking this language reviewed.');
  value.reviewed = true;
  value.sourceHash = contentHash(item.values[item.sourceLocale]);
  return saveSnapshot(snapshot);
}
