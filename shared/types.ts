export const LOCALES = ['zh-CN', 'en', 'fr'] as const;
export const CURSOR_GLOW_RADIUS = { min: 100, max: 1200, default: 600 } as const;
export type Locale = (typeof LOCALES)[number];
export type EntryType = 'project' | 'post' | 'page' | 'experience';
export interface LocalizedContent {
  title: string;
  summary: string;
  body: string;
  reviewed: boolean;
  sourceHash: string;
}
export interface Entry {
  id: string;
  type: EntryType;
  slug: string;
  status: 'draft' | 'published';
  sourceLocale: Locale;
  translations: Record<Locale, LocalizedContent>;
  coverId: string | null;
  tags: string[];
  featured: boolean;
  order: number;
  date: string;
  url: string;
  period: string;
}
export interface Profile {
  name: string;
  headline: string;
  intro: string;
  about: string;
  seoDescription: string;
  reviewed: boolean;
  sourceHash: string;
}
export interface SocialLink {
  id: string;
  label: string;
  url: string;
  icon: string;
}
export interface Media {
  id: string;
  filename: string;
  path: string;
  width: number;
  height: number;
  alt: Record<Locale, string>;
  caption: Record<Locale, string>;
  /** Optional, owner-defined grouping. Missing values keep legacy media uncategorized. */
  collection?: string;
  /** Searchable, language-neutral organizational labels. */
  tags?: string[];
  /** Set for new uploads; legacy assets intentionally remain without a timestamp. */
  uploadedAt?: string;
}
export interface HomeSection {
  id: string;
  enabled: boolean;
  /** Missing or blank built-in titles use the original localized labels. */
  titles?: Record<Locale, string>;
  /** Optional Markdown introduction for a custom section. */
  body?: Record<Locale, string>;
  /** Ordered cards for a custom section; only published entries are rendered. */
  entryIds?: string[];
}
export interface SiteSettings {
  sourceLocale: Locale;
  profile: Record<Locale, Profile>;
  accent: string;
  background: string;
  cursorGlowRadius: number;
  defaultLocale: Locale;
  sections: HomeSection[];
  socials: SocialLink[];
  avatarId: string | null;
  resumeUrl: string;
  siteUrl: string;
}
export interface Snapshot {
  schemaVersion: 1;
  revision: number;
  settings: SiteSettings;
  entries: Entry[];
  media: Media[];
}
export interface ValidationIssue {
  path: string;
  message: string;
}
export interface Release {
  id: string;
  revision: number;
  status: 'building' | 'ready' | 'failed' | 'published';
  createdAt: string;
  publishedAt: string | null;
  error: string | null;
  previewUrl: string;
  previewedAt: string | null;
}
export type TranslationProvider = 'mymemory' | 'libretranslate' | 'openai';
export interface TranslationStatus {
  configured: boolean;
  model: string | null;
  defaultProvider: TranslationProvider;
  providers: Array<{ id: TranslationProvider; label: string; configured: boolean }>;
}
