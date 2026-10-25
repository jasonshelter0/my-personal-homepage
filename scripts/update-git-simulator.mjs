/** Import a rebuilt, reviewed portable simulator into Astro's source assets.
 * Usage: node scripts/update-git-simulator.mjs /path/to/patched/learnGitBranching
 * See docs/GIT_BRANCHING.md for the pinned source and reconstruction steps.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const source = process.argv[2];
if (!source) throw new Error('Provide the patched Learn Git Branching checkout path.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'apps/site/public/learn-assets/git-branching');
const html = fs.readFileSync(path.resolve(source, 'dist/index.html'));
const text = html.toString('utf8');
if (!text.includes('website-trilingual-3') || /<script\b[^>]+\bsrc\s*=/i.test(text)
  || /<link\b[^>]*rel="(?:stylesheet|modulepreload)"/i.test(text))
  throw new Error('Expected the self-contained, localized mobile build.');
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, 'simulator.html'), html);
fs.copyFileSync(path.resolve(source, 'LICENSE.md'), path.join(destination, 'LICENSE.txt'));
console.log(JSON.stringify({ bytes: html.length, sha256: createHash('sha256').update(html).digest('hex') }));
