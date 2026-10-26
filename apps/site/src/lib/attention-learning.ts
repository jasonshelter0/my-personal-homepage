import en from '../content/learn/attention/en.json';
import fr from '../content/learn/attention/fr.json';
import zh from '../content/learn/attention/zh-cn.json';
import type { Locale } from './data';
export const attentionPath = 'learn/learnpytorch/attention';
export const attentionCopy: Record<Locale, typeof en> = { en, fr, 'zh-CN': zh };
