import sanitize from 'sanitize-html';
import zh from '../content/learn/mamba-tta-irstd/zh-CN.json';
import en from '../content/learn/mamba-tta-irstd/en.json';
import fr from '../content/learn/mamba-tta-irstd/fr.json';
import type { Locale } from '../../../../shared/types';

export const learningTopic = 'mamba-tta-irstd';
export interface Lesson {
  slug: string;
  label: string;
  title: string;
  lede: string;
  body: string;
  minutes: string;
}
export const lessonsByLocale: Record<Locale, Lesson[]> = { 'zh-CN': zh, en, fr };
export const lessonPath = (slug = 'index') =>
  `learn/${learningTopic}${slug === 'index' ? '' : `/${slug}`}`;
export const learningPaths = zh.map((lesson) => lessonPath(lesson.slug));
export const learningCopy = {
  'zh-CN': {
    title: 'Mamba × TTA/TTT：单帧红外小目标检测',
    summary: '从选择性状态空间、二维扫描到测试时适应，结合 NUAA-SIRST、NUDT-SIRST 与 IRSTD-1k 设计可验证的实验。',
    detail: '11 个页面 · 9 个学习单元 · 6 个交互演示',
    read: '进入课程',
  },
  en: {
    title: 'Mamba × TTA/TTT for single-frame infrared small-target detection',
    summary: 'Explore selective state spaces, 2D scanning and test-time adaptation, then design testable experiments on NUAA-SIRST, NUDT-SIRST and IRSTD-1k.',
    detail: '11 pages · 9 learning units · 6 interactive demonstrations',
    read: 'Start learning',
  },
  fr: {
    title: 'Mamba × TTA/TTT pour la détection de petites cibles infrarouges sur une image',
    summary: 'Des espaces d’état sélectifs au balayage 2D et à l’adaptation au test : concevez des expériences vérifiables sur NUAA-SIRST, NUDT-SIRST et IRSTD-1k.',
    detail: '11 pages · 9 unités · 6 démonstrations interactives',
    read: 'Commencer le cours',
  },
};

export function plainLessonTitle(title: string): string {
  return sanitize(title.replace(/<br\s*\/?>/gi, ' '), { allowedTags: [], allowedAttributes: {} });
}

// Reviewed source content only. Never render remote HTML or private CMS drafts.
export function renderLessonBody(body: string, resolve: (path: string) => string): string {
  const slugs = new Set(zh.map((lesson) => lesson.slug));
  return sanitize(body, {
    allowedTags: [
      ...sanitize.defaults.allowedTags, 'section', 'article', 'aside', 'details', 'summary',
      'fieldset', 'legend', 'label', 'input', 'button', 'output',
    ],
    allowedAttributes: {
      '*': ['class', 'id', 'tabindex'],
      a: ['href', 'title', 'target', 'rel'],
      th: ['scope'],
      section: ['class', 'data-answer', 'data-explanation'],
      div: ['class', 'tabindex', 'data-demo'],
      input: ['type', 'name', 'value'],
      button: ['class', 'type'],
      label: ['for'],
      p: ['class', 'aria-live'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attrs) => {
        const match = /^([a-z-]+)\.html$/.exec(attrs.href || '');
        const href = match && slugs.has(match[1]) ? resolve(lessonPath(match[1])) : attrs.href;
        return { tagName, attribs: { ...attrs, href, rel: 'noopener noreferrer' } };
      },
    },
  });
}
