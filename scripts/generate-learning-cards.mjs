// Regenerate checked-in Open Graph diagrams from the same attention math as the lab.
import fs from 'node:fs';
import sharp from 'sharp';
import { attention, fixture, targetSettings } from '../apps/site/src/lib/attention-lab/engine.mjs';
const dir = 'apps/site/public/learn-assets/learnpytorch';
fs.mkdirSync(dir, { recursive: true });
const weights = attention(fixture(0), targetSettings('causal')).weights;
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  );
for (const locale of ['en', 'fr', 'zh-cn']) {
  const t = JSON.parse(
    fs.readFileSync(`apps/site/src/content/learn/pytorch-course/${locale}.json`, 'utf8'),
  );
  const labels =
    locale === 'en'
      ? ['19 visual challenges', 'Tensors · Autograd · Attention', 'No installation. No account.']
      : locale === 'fr'
        ? ['19 défis visuels', 'Tenseurs · Autograd · Attention', 'Sans installation. Sans compte.']
        : ['19 个可视化挑战', '张量 · 自动微分 · 注意力', '无需安装，无需账号'];
  const cells = weights
    .flatMap((row, i) =>
      row.map(
        (w, j) =>
          `<rect x="${800 + j * 78}" y="${200 + i * 78}" width="68" height="68" rx="8" fill="rgb(${Math.round(20 + w * 50)},${Math.round(45 + w * 175)},${Math.round(60 + w * 145)})"/><text x="${834 + j * 78}" y="${242 + i * 78}" text-anchor="middle" font-size="19" fill="#e2e8f0">${w.toFixed(2)}</text>`,
      ),
    )
    .join('');
  const subtitle = t.title.replace(/^LearnPyTorch[:：]\s*/, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0f172a"/><g font-family="sans-serif"><text x="64" y="110" font-size="26" fill="#5eead4">${escape(labels[0])}</text><text x="64" y="215" font-size="68" font-weight="bold" fill="#e2e8f0">LearnPyTorch</text><text x="64" y="280" font-size="30" fill="#e2e8f0">${escape(subtitle)}</text><text x="64" y="365" font-size="24" fill="#94a3b8">${escape(labels[1])}</text><text x="64" y="410" font-size="24" fill="#94a3b8">${escape(labels[2])}</text>${cells}<path d="M 64 505 H 1120" stroke="#334155"/><text x="64" y="565" font-size="23" fill="#5eead4">jasonshelter.com/learn/learnpytorch/</text></g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${dir}/social-${locale}.png`);
}
