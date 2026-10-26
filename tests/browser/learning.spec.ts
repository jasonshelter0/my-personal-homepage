import { test, expect } from '@playwright/test';
const live = 'http://127.0.0.1:4523';
const topic = 'learn/mamba-tta-irstd';
let preview = '';
const chapters = ['', 'foundations', 'mamba', 'vmamba', 'tent', 'cotta', 'frontier', 'ttt', 'ttt-vision', 'irstd', 'ttt-plan', 'lab', 'references'];

test.beforeAll(async ({ request }) => {
  expect((await request.post('/api/login', { data: { password: 'local-demo-password' } })).ok()).toBeTruthy();
  const response = await request.post('/api/releases', { data: {} });
  expect(response.status()).toBe(202);
  const release = await response.json();
  preview = release.previewUrl;
  await expect.poll(async () => {
    const { releases } = await (await request.get('/api/releases')).json();
    return releases.find((r: { id: string }) => r.id === release.id)?.status;
  }, { timeout: 90000 }).toBe('ready');
  expect((await request.get(release.previewUrl)).ok()).toBeTruthy();
  expect((await request.post(`/api/releases/${release.id}/publish`, { data: {} })).ok()).toBeTruthy();
});

test('all localized chapters fit a phone and share navigation, SEO and compliance', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(response.url()); });
  await page.setViewportSize({ width: 360, height: 800 });
  for (const locale of ['zh-cn', 'en', 'fr']) {
    for (const chapter of chapters) {
      const path = `/${locale}/${topic}/${chapter ? chapter + '/' : ''}`;
      expect((await page.goto(live + path))?.status()).toBe(200);
      await expect(page.locator('.learning-course')).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path).toBeTruthy();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(path.replaceAll('/', '\\/') + '$'));
      await expect(page.locator('.languages a')).toHaveCount(3);
      await expect(page.locator('a[href="https://beian.miit.gov.cn/"]')).toHaveText('京ICP备2024092234号-1');
      if (locale !== 'zh-cn') expect(await page.locator('.learning-course').innerText()).not.toMatch(/[\u3400-\u9fff]/);
    }
  }
  expect(errors).toEqual([]);
  await page.goto(`${live}/learn/mamba-tta-irstd/`);
  await expect(page).toHaveURL(new RegExp('/(zh-cn|en|fr)/learn/mamba-tta-irstd/$'));
});

test('interactive learning, local persistence, language switching, search and export work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${live}/en/${topic}/tent/`);
  const p = page.locator('[data-demo="entropy"] [data-control="p"]');
  await p.fill('0.9');
  await p.dispatchEvent('input');
  await expect(page.locator('[data-demo="entropy"] .demo-result')).toContainText('0.5');
  await page.locator('.quiz input[value="1"]').check();
  await page.locator('.quiz-check').click();
  await expect(page.locator('.quiz-result')).toHaveClass(/correct/);
  await page.locator('textarea[data-note]').fill('Check foreground collapse on the source validation set.');
  await page.locator('.mark-complete').click();
  await page.reload();
  await expect(page.locator('textarea[data-note]')).toHaveValue('Check foreground collapse on the source validation set.');
  await expect(page.locator('.mark-complete')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.languages a[lang="fr"]').click();
  await expect(page).toHaveURL(new RegExp('/fr/learn/mamba-tta-irstd/tent/$'));
  await page.locator('[data-open-search]').click();
  await page.locator('#search-input').fill('Mamba');
  await expect(page.locator('#search-results a[href*="/learn/mamba-tta-irstd/"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(`${live}/en/${topic}/lab/`);
  await page.locator('[data-control="mode"]').selectOption('continual');
  await page.locator('[data-control="timing"]').selectOption('adapt_before_predict');
  const download = page.waitForEvent('download');
  await page.locator('.export-protocol').click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const config = JSON.parse(Buffer.concat(chunks).toString());
  expect(config.mode).toBe('continual');
  expect(config.prediction_timing).toBe('adapt_before_predict');
  await page.mouse.move(100, 300);
  await expect(page.locator('.cursor-glow')).toHaveAttribute('data-active', 'true');
  expect(errors).toEqual([]);
});


test('TTT inner steps remain numerical, accessible and usable without browser storage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.setViewportSize({ width: 320, height: 760 });
  for (const locale of ['zh-cn', 'en', 'fr']) {
    await page.goto(`${live}/${locale}/${topic}/ttt/`);
    const demo = page.locator('[data-demo="ttt-inner"]');
    const metric = (name: string) => demo.locator(`[data-ttt-metric="${name}"]`);
    await expect(metric('weight')).toHaveText(locale === 'fr' ? '0,2' : '0.2');
    await expect(metric('readout')).toHaveText(locale === 'fr' ? '0,6' : '0.6');
    await demo.locator('[data-ttt-control="steps"]').fill('0');
    await expect(metric('weight')).toHaveText('0');
    expect(await demo.locator('svg').evaluateAll(els => els.every(el => !/NaN|Infinity/.test(el.outerHTML)))).toBeTruthy();
    await demo.locator('[data-ttt-action="step"]').click();
    await expect(metric('weight')).toHaveText(locale === 'fr' ? '0,2' : '0.2');
    await demo.locator('[data-ttt-control="eta"]').fill('1');
    await expect(demo.locator('[data-ttt-status]')).toContainText('|1−ηk²|>1');
    await demo.locator('[data-ttt-action="reset"]').click();
    await expect(metric('loss')).toHaveText(locale === 'fr' ? '0,18' : '0.18');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  }
  expect(errors).toEqual([]);
});

test('TTT matrix export requires measured timings and invalidates speeds on resolution changes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(`${live}/en/${topic}/ttt-plan/`);
  const demo = page.locator('[data-demo="ttt-plan"]');
  const cost = demo.locator('[data-ttt-metric="gpu-hours"]');
  await expect(cost).toHaveText('—');
  for (const id of ['S0', 'B0', 'B1', 'B2', 'H0', 'H1']) await demo.locator(`[data-ttt-speed="${id}"]`).fill('1');
  await expect(cost).not.toHaveText('—');
  await demo.locator('[data-ttt-control="resolution"]').selectOption('512');
  for (const id of ['B0', 'B1', 'B2']) await expect(demo.locator(`[data-ttt-speed="${id}"]`)).toHaveValue('');
  for (const id of ['S0', 'H0', 'H1']) await expect(demo.locator(`[data-ttt-speed="${id}"]`)).toHaveValue('1');
  await expect(cost).toHaveText('—');
  await expect(demo.locator('[data-ttt-plan-status]')).toContainText('Resolution changed');
  const download = page.waitForEvent('download');
  await demo.locator('[data-ttt-action="export"]').click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const plan = JSON.parse(Buffer.concat(chunks).toString());
  expect(plan.status).toBe('draft_not_executed');
  expect(plan.method_family).toBe('TTT_layers_not_Tent_SAR');
  expect(plan.estimate.gpuHours).toBeNull();
  expect(plan.jobs.find((job: { id: string }) => job.id === 'B0').resolution).toBe(512);
  expect(plan.jobs.find((job: { id: string }) => job.id === 'B0').secondsPerStep).toBeNull();
  await demo.locator('[data-ttt-control="epochs"]').fill('0');
  await expect(demo.locator('[data-ttt-action="export"]')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});

test('TTT chapters preserve preview paths, search, progress and fullscreen', async ({ page }) => {
  expect((await page.request.post('/api/login', { data: { password: 'local-demo-password' } })).ok()).toBeTruthy();
  const entry = new URL(preview, 'http://127.0.0.1:4521');
  expect((await page.goto(entry.href))?.status()).toBe(200);
  const base = new URL(entry.pathname, entry.origin);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto(`${base}en/${topic}/ttt-vision/`);
  await page.locator('[data-reader-toggle]').click();
  await expect(page.locator('#site-profile')).toBeHidden();
  await page.locator('[data-reader-fullscreen]').click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.locator('[data-reader-fullscreen]').click();
  await page.locator('.mark-complete').click();
  await page.locator('.learning-chapters summary').click();
  await expect(page.locator('.progress-bar')).toHaveAttribute('aria-valuemax', '11');
  await expect(page.locator('.progress-bar')).toHaveAttribute('aria-valuenow', '1');
  await page.locator('.reader-languages a[lang="fr"]').click();
  await expect(page).toHaveURL(`${base}fr/${topic}/ttt-vision/`);
  await expect(page.locator('.mark-complete')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-reader-search]').click();
  await page.locator('#search-input').fill('TTT');
  const result = page.locator('#search-results a[href*="ttt"]').first();
  await expect(result).toBeVisible();
  expect(await result.getAttribute('href')).toContain(base.pathname);
  await page.keyboard.press('Escape');
  await page.goto(`${base}fr/${topic}/ttt-plan/`);
  await expect(page.locator('[data-demo="ttt-plan"] [data-ttt-action="export"]')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).not.toHaveAttribute('href', /preview/);
});
