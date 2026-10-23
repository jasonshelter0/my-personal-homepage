import fs from 'node:fs';
import { marked } from 'marked';
import sanitize from 'sanitize-html';
import { seed } from '../../../../shared/seed.ts';
import { LOCALES, type Locale, type Snapshot, type Entry } from '../../../../shared/types.ts';
export { LOCALES };
export type { Locale, Entry };
export const snapshot: Snapshot = process.env.FOLIO_SNAPSHOT
  ? JSON.parse(fs.readFileSync(process.env.FOLIO_SNAPSHOT, 'utf8'))
  : seed;
export const entries = snapshot.entries
  .filter((e) => e.status === 'published')
  .sort((a, b) => a.order - b.order);
export const localePath = (locale: Locale) => (locale === 'zh-CN' ? 'zh-cn' : locale);
export const href = (locale: Locale, path = '') =>
  `/${localePath(locale)}/${path}${path && !path.endsWith('/') ? '/' : ''}`;
export const collection = (type: Entry['type']) =>
  ({ project: 'projects', post: 'posts', page: 'pages', experience: 'experience' })[type];
export const entryHref = (locale: Locale, entry: Entry) =>
  href(locale, `${collection(entry.type)}/${entry.slug}`);
export const media = (id: string | null) => snapshot.media.find((m) => m.id === id);
export function safeUrl(value: string): string {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(value) ? value : '#';
}
export function markdown(value: string): string {
  return sanitize(marked.parse(value, { async: false }) as string, {
    allowedTags: [...sanitize.defaults.allowedTags, 'img'],
    allowedAttributes: {
      ...sanitize.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      a: ['href', 'title', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }),
    },
  });
}
export const copy = {
  'zh-CN': {
    all: '全部',
    tags: '标签',
    resultCount: '找到 {count} 条结果',
    about: '关于',
    experience: '经历',
    projects: '项目',
    writing: '文章',
    pages: '信息',
    archive: '所有项目',
    allPosts: '所有文章',
    allPages: '更多信息',
    home: '主页',
    back: '返回',
    read: '阅读文章',
    visit: '访问项目',
    resume: '查看简历',
    search: '搜索',
    searchPlaceholder: '搜索文章、项目与信息…',
    searchHint: '输入关键词，探索这个网站。',
    searchLoading: '正在搜索…',
    searchEmpty: '没有找到相关内容。换个关键词试试。',
    searchUnavailable: '搜索索引尚未就绪，请在构建发布后重试。',
    close: '关闭',
    results: '搜索结果',
    skip: '跳至主要内容',
    demo: 'FOLIO 演示站点 · 所有人物与经历内容均为示例',
    built: '用心设计，持续记录。',
    language: '语言',
    openImage: '放大图片',
    notFound: '这个页面还没有故事。',
    notFoundBody: '链接可能已更改，或页面尚未发布。',
    returnHome: '回到主页',
    project: '项目',
    post: '文章',
    page: '信息',
    experienceSingular: '经历',
    empty: '新的内容正在路上。',
    updated: '发布于',
    toc: '本页导航',
    print: '打印 / 保存为 PDF',
    external: '在新标签页打开',
    theme: '个人作品与记录',
    searchKeyboard: '按 Esc 关闭 · Ctrl / ⌘ K 搜索',
  },
  en: {
    all: 'All',
    tags: 'Tags',
    resultCount: '{count} results found',
    about: 'About',
    experience: 'Experience',
    projects: 'Projects',
    writing: 'Writing',
    pages: 'Information',
    archive: 'View all projects',
    allPosts: 'View all writing',
    allPages: 'More information',
    home: 'Home',
    back: 'Back',
    read: 'Read story',
    visit: 'Visit project',
    resume: 'View résumé',
    search: 'Search',
    searchPlaceholder: 'Search writing, projects & pages…',
    searchHint: 'A word, an idea, something worth finding.',
    searchLoading: 'Searching…',
    searchEmpty: 'Nothing here yet. Try a different word.',
    searchUnavailable: 'The search index is not ready. Please try again after publishing.',
    close: 'Close',
    results: 'Search results',
    skip: 'Skip to content',
    demo: 'FOLIO DEMO · All people and experiences are illustrative',
    built: 'Thoughtfully made. Always evolving.',
    language: 'Language',
    openImage: 'Enlarge image',
    notFound: 'This page has no story yet.',
    notFoundBody: 'The link may have changed, or this page is not published.',
    returnHome: 'Back to home',
    project: 'Project',
    post: 'Writing',
    page: 'Information',
    experienceSingular: 'Experience',
    empty: 'Something new is on its way.',
    updated: 'Published',
    toc: 'On this page',
    print: 'Print / Save as PDF',
    external: 'Opens in a new tab',
    theme: 'Selected work & field notes',
    searchKeyboard: 'Esc to close · Ctrl / ⌘ K to search',
  },
  fr: {
    all: 'Tout',
    tags: 'Étiquettes',
    resultCount: '{count} résultats',
    about: 'À propos',
    experience: 'Parcours',
    projects: 'Projets',
    writing: 'Articles',
    pages: 'Informations',
    archive: 'Tous les projets',
    allPosts: 'Tous les articles',
    allPages: 'Plus d’informations',
    home: 'Accueil',
    back: 'Retour',
    read: 'Lire l’article',
    visit: 'Voir le projet',
    resume: 'Voir le CV',
    search: 'Rechercher',
    searchPlaceholder: 'Rechercher articles, projets et pages…',
    searchHint: 'Un mot, une idée, une découverte.',
    searchLoading: 'Recherche…',
    searchEmpty: 'Aucun résultat. Essayez un autre mot.',
    searchUnavailable: 'L’index de recherche n’est pas prêt. Réessayez après la publication.',
    close: 'Fermer',
    results: 'Résultats de recherche',
    skip: 'Aller au contenu',
    demo: 'DÉMO FOLIO · Les personnes et parcours présentés sont fictifs',
    built: 'Conçu avec soin. Toujours en mouvement.',
    language: 'Langue',
    openImage: 'Agrandir l’image',
    notFound: 'Cette page n’a pas encore d’histoire.',
    notFoundBody: 'Le lien a peut-être changé, ou la page n’est pas publiée.',
    returnHome: 'Retour à l’accueil',
    project: 'Projet',
    post: 'Article',
    page: 'Information',
    experienceSingular: 'Expérience',
    empty: 'De nouvelles idées arrivent bientôt.',
    updated: 'Publié le',
    toc: 'Sur cette page',
    print: 'Imprimer / Enregistrer en PDF',
    external: 'S’ouvre dans un nouvel onglet',
    theme: 'Projets choisis & carnets',
    searchKeyboard: 'Échap pour fermer · Ctrl / ⌘ K pour rechercher',
  },
} as const;
export const dateLabel = (date: string, locale: Locale) =>
  date && !Number.isNaN(Date.parse(date))
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(date))
    : date;
export const siteUrl = /^https?:\/\//.test(snapshot.settings.siteUrl)
  ? snapshot.settings.siteUrl.replace(/\/$/, '')
  : '';
