import { z } from 'zod';
import type { Snapshot } from '../shared/types.ts';
const short = z.string().max(500);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const locale = z.enum(['zh-CN', 'en', 'fr']);
const webUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      const u = new URL(value);
      return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Use an http(s) URL');
const socialUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        (['http:', 'https:'].includes(u.protocol) && !u.username && !u.password) ||
        (u.protocol === 'mailto:' && /^[^\s@]+@[^\s@]+$/.test(u.pathname) && !u.search && !u.hash)
      );
    } catch {
      return false;
    }
  }, 'Use an http(s) or email URL');
const translated = z
  .object({
    title: short,
    summary: z.string().max(5000),
    body: z.string().max(200000),
    reviewed: z.boolean(),
    sourceHash: z.string().max(100),
  })
  .strict();
const profile = z
  .object({
    name: short,
    headline: short,
    intro: z.string().max(5000),
    about: z.string().max(50000),
    seoDescription: z.string().max(1000),
    reviewed: z.boolean(),
    sourceHash: z.string().max(100),
  })
  .strict();
const tri = <T extends z.ZodType>(schema: T) =>
  z.object({ 'zh-CN': schema, en: schema, fr: schema }).strict();
export const snapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    settings: z
      .object({
        sourceLocale: locale,
        profile: tri(profile),
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        defaultLocale: locale,
        sections: z
          .array(
            z
              .object({
                id: z.enum(['about', 'experience', 'projects', 'writing']),
                enabled: z.boolean(),
              })
              .strict(),
          )
          .length(4),
        socials: z
          .array(
            z
              .object({
                id,
                label: short,
                url: socialUrl,
                icon: z
                  .string()
                  .max(50)
                  .regex(/^[a-zA-Z0-9_-]+$/),
              })
              .strict(),
          )
          .max(30),
        avatarId: id.nullable(),
        resumeUrl: webUrl,
        siteUrl: webUrl,
      })
      .strict(),
    entries: z
      .array(
        z
          .object({
            id,
            type: z.enum(['project', 'post', 'page', 'experience']),
            slug: z
              .string()
              .max(100)
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            status: z.enum(['draft', 'published']),
            sourceLocale: locale,
            translations: tri(translated),
            coverId: id.nullable(),
            tags: z.array(z.string().max(100)).max(30),
            featured: z.boolean(),
            order: z.number().int().min(-10000).max(10000),
            date: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
            url: webUrl,
            period: short,
          })
          .strict(),
      )
      .max(2000),
    media: z
      .array(
        z
          .object({
            id,
            filename: z.string().regex(/^[a-zA-Z0-9_-]+\.(?:webp|svg)$/),
            path: z.string().regex(/^\/media\/[a-zA-Z0-9_-]+\.(?:webp|svg)$/),
            width: z.number().int().positive().max(10000),
            height: z.number().int().positive().max(10000),
            alt: tri(z.string().max(1000)),
            caption: tri(z.string().max(5000)),
          })
          .strict(),
      )
      .max(5000),
  })
  .strict()
  .superRefine((s, ctx) => {
    const duplicate = (items: string[], path: string) => {
      if (new Set(items).size !== items.length)
        ctx.addIssue({
          code: 'custom',
          path: [path],
          message: 'Duplicate identifiers are not allowed',
        });
    };
    duplicate(
      s.entries.map((e) => e.id),
      'entries',
    );
    duplicate(
      s.media.map((m) => m.id),
      'media',
    );
    duplicate(
      s.settings.socials.map((x) => x.id),
      'socials',
    );
    duplicate(
      s.settings.sections.map((x) => x.id),
      'sections',
    );
    for (const m of s.media)
      if (m.path !== `/media/${m.filename}`)
        ctx.addIssue({ code: 'custom', path: ['media'], message: 'Invalid media path' });
  });
export function parseSnapshot(value: unknown): Snapshot {
  return snapshotSchema.parse(value) as Snapshot;
}
export { locale as localeSchema };
