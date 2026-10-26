import type { Locale } from './data';
import en from '../content/learn/learnpytorch/en.json';
import zh from '../content/learn/learnpytorch/zh-cn.json';
import fr from '../content/learn/learnpytorch/fr.json';

export const tensorLearningPath = 'learn/learnpytorch';
export const tensorLearningCopy = { 'zh-CN': zh, en, fr } satisfies Record<Locale, typeof en>;
