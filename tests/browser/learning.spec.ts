import { test, expect } from '@playwright/test';
const live = 'http://127.0.0.1:4523';
const topic = 'learn/mamba-tta-irstd';
const chapters = ['', 'foundations', 'mamba', 'vmamba', 'tent', 'cotta', 'frontier', 'ttt', 'irstd', 'lab', 'references'];

test.beforeAll(async ({ request }) => {
  expect((await request.post('/api/login', { data: { password: 'local-demo-password' } })).ok()).toBeTruthy();
  const response = await request.post('/api/releases', { data: {} });
  expect(response.status()).toBe(202);
  const release = await response.json();
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
