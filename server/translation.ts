import { z } from 'zod';
import {
  type Locale,
  type LocalizedContent,
  type Profile,
  type Snapshot,
} from '../shared/types.ts';
import { contentHash } from '../shared/validation.ts';
import { getSnapshot, saveSnapshot, HttpError } from './store.ts';
import { localeSchema } from './schema.ts';
import { translationStatus, translateProse, translateOpenAI } from './translation-providers.ts';
export { translationStatus } from './translation-providers.ts';
const requestSchema = z
  .object({
    entryId: z.string().max(100).optional(),
    profile: z.literal(true).optional(),
    targetLocale: localeSchema,
    overwrite: z.boolean().optional(),
    provider: z.enum(['mymemory', 'libretranslate', 'openai']).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.entryId) !== Boolean(v.profile), 'Choose an entry or profile.');
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
export async function translate(input: unknown): Promise<Snapshot> {
  const request = requestSchema.parse(input);
  const status = translationStatus();
  const provider = request.provider || status.defaultProvider;
  if (!status.providers.find((item) => item.id === provider)?.configured)
    throw new HttpError(503, 'The selected translation provider is not configured.');
  const snapshot = getSnapshot(),
    item = target(snapshot, request);
  if (item.sourceLocale === request.targetLocale)
    throw new HttpError(400, 'Choose a different target language.');
  const existing = item.values[request.targetLocale];
  if (existing.reviewed && !request.overwrite)
    throw new HttpError(409, 'This translation was reviewed. Confirm overwrite explicitly.');
  const original = item.values[item.sourceLocale],
    source = Object.fromEntries(
      item.keys.map((k) => [k, (original as unknown as Record<string, string>)[k]]),
    );
  const payload =
    provider === 'openai'
      ? await translateOpenAI(source, item.sourceLocale, request.targetLocale)
      : await translateProse(source, item.sourceLocale, request.targetLocale, provider);
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
  const shape = Object.fromEntries(item.keys.map((k) => [k, z.string().min(1).max(limits[k])]));
  const parsed = z.object(shape).strict().safeParse(payload);
  if (!parsed.success)
    throw new HttpError(502, 'Translation response has missing or invalid fields.');
  for (const key of item.keys)
    if (
      JSON.stringify(preserveTokens(source[key])) !==
      JSON.stringify(preserveTokens(parsed.data[key]))
    )
      throw new HttpError(
        502,
        'Translation changed a link or code fragment. Your draft has not changed.',
      );
  const current = getSnapshot();
  if (current.revision !== snapshot.revision)
    throw new HttpError(409, 'The draft changed while translating. Please retry.');
  const translated = { ...parsed.data, reviewed: false, sourceHash: contentHash(original) };
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
