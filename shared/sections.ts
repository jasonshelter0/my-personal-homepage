import type { HomeSection, Locale } from './types.ts';

export const BUILTIN_SECTION_IDS = ['about', 'experience', 'projects', 'writing'] as const;
export type BuiltinSectionId = (typeof BUILTIN_SECTION_IDS)[number];

export function isBuiltinSection(id: string): id is BuiltinSectionId {
  return (BUILTIN_SECTION_IDS as readonly string[]).includes(id);
}

const titles: Record<Locale, Record<BuiltinSectionId, string>> = {
  'zh-CN': { about: '关于', experience: '经历', projects: '项目', writing: '文章' },
  en: { about: 'About', experience: 'Experience', projects: 'Projects', writing: 'Writing' },
  fr: { about: 'À propos', experience: 'Parcours', projects: 'Projets', writing: 'Articles' },
};
const untitled: Record<Locale, string> = {
  'zh-CN': '未命名分区',
  en: 'Untitled section',
  fr: 'Section sans titre',
};

/** Draft editors can display unfinished sections; publication validates translations. */
export function sectionTitle(section: HomeSection, locale: Locale): string {
  return (
    section.titles?.[locale]?.trim() ||
    (isBuiltinSection(section.id) ? titles[locale][section.id] : untitled[locale])
  );
}
