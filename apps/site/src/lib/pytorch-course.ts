import en from '../content/learn/pytorch-course/en.json';
import fr from '../content/learn/pytorch-course/fr.json';
import zh from '../content/learn/pytorch-course/zh-cn.json';
import { tensorLearningCopy } from './tensor-learning';
import { autogradCopy } from './autograd-learning';
import { attentionCopy } from './attention-learning';
import type { Locale } from './data';
export const courseCopy: Record<Locale, typeof en> = { en, fr, 'zh-CN': zh };
export const chapterIds = ['tensor', 'autograd', 'attention'] as const;
export const chapterLessons = [
  ['axes', 'broadcast', 'batch', 'flatten', 'squeeze', 'channel-bias', 'pool', 'linear', 'softmax'],
  ['chain', 'detach', 'accumulation', 'training'],
  ['scores', 'scale', 'axis', 'causal', 'values', 'capstone'],
];
export function courseChapters(locale: Locale) {
  const t = courseCopy[locale];
  const labels = [
    tensorLearningCopy[locale].lessons.map((l) => l.short),
    autogradCopy[locale].missions.map((l) => l.short),
    attentionCopy[locale].missions.map((l) => l.title),
  ];
  return chapterIds.map((id, i) => ({
    id,
    path: 'learn/learnpytorch' + (i ? '/' + id : ''),
    title: t.chapters[i],
    note: t.notes[i],
    lessons: chapterLessons[i].map((lesson, j) => ({
      id: lesson,
      label: labels[i][j],
      hash: `#${id}-${lesson}`,
    })),
  }));
}
