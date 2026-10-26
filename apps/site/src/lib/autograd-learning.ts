import type { Locale } from './data';
import en from '../content/learn/autograd/en.json';
import zh from '../content/learn/autograd/zh-cn.json';
import fr from '../content/learn/autograd/fr.json';
export const autogradPath = 'learn/learnpytorch/autograd';
export const autogradCopy = { 'zh-CN': zh, en, fr } satisfies Record<Locale, typeof en>;
