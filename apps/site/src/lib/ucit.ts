import { z } from 'zod';
import content from '../content/ucit/usage.json';
import version from '../content/ucit/version.json';
import type { Locale } from '../../../../shared/types';
const text = z.string().trim().min(1);
const locale = z.object({
  title: text, summary: text,
  labels: z.object({ eyebrow: text, download: text, source: text, contents: text, version: text,
    updated: text, loop: text, stateHint: text, copy: text, copied: text, copyError: text, example: text, note: text }),
  states: z.array(z.object({ code: z.enum(['P','A','W','S','C']), name: text, body: text })).length(5),
  sections: z.array(z.object({ id: text.regex(/^[a-z]+$/), title: text, body: text })).length(7),
});
export const ucit = z.object({ schemaVersion: z.literal(1), pluginVersion: text,
  updated: text, author: z.literal('Jason Shelter'),
  repository: z.literal('https://github.com/jasonshelter0/obsidian-ucit-home'),
  locales: z.object({ 'zh-CN': locale, en: locale, fr: locale }),
}).parse(content);
if (version.pluginVersion !== ucit.pluginVersion) throw new Error('UCIT guide version mismatch; rerun docs:sync in the plugin repository.');
export const ucitVersion = version;
export const ucitPath = 'projects/ucit-home';
export const ucitCoverAlt: Record<Locale, string> = {
  'zh-CN': '一条薄荷色工作流将计划、执行、证据与闭环连接起来',
  en: 'A mint workflow loop connecting planned work to evidence and closure',
  fr: 'Une boucle menthe relie la planification, l’action, les preuves et la clôture',
};
