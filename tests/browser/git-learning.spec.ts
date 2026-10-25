import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const live = 'http://127.0.0.1:4523';
const topic = 'learn/git-branching/';
let previewPath = '';

test.beforeAll(async ({ request }) => {
  expect((await request.post('/api/login', { data: { password: 'local-demo-password' } })).ok()).toBeTruthy();
  const response = await request.post('/api/releases', { data: {} });
  expect(response.status()).toBe(202);
  const release = await response.json();
  previewPath = release.previewUrl;
  await expect.poll(async () => {
    const { releases } = await (await request.get('/api/releases')).json();
    return releases.find((item: { id: string }) => item.id === release.id)?.status;
  }, { timeout: 90000 }).toBe('ready');
  expect((await request.get(previewPath)).ok()).toBeTruthy();
  expect((await request.post(`/api/releases/${release.id}/publish`, { data: {} })).ok()).toBeTruthy();
});

test('three language lessons include usable mobile Git simulation, navigation and search', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.setViewportSize({ width: 360, height: 800 });
  for (const [locale, run] of [['zh-cn', '运行 ↵'], ['en', 'Run ↵'], ['fr', 'Exécuter ↵']]) {
    expect((await page.goto(`${live}/${locale}/${topic}`))?.status()).toBe(200);
    await expect(page.locator('.git-learning h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    if (locale !== 'zh-cn') expect(await page.locator('.git-learning').innerText()).not.toMatch(/[\u3400-\u9fff]/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/${locale}/${topic}$`));
    await expect(page.locator('a[href="https://beian.miit.gov.cn/"]')).toHaveText('京ICP备2024092234号-1');
    await page.locator('[data-git-open]').click();
    const frame = page.frameLocator('#git-stage iframe');
    await expect(frame.locator('#pocketStartup')).toBeHidden({ timeout: 15000 });
    await expect(frame.locator('#pocketRun')).toHaveText(run);
    await frame.locator('#commandTextField').fill('git commit');
    await frame.locator('#pocketRun').click();
    await expect(frame.locator('#canvasHolder')).toContainText('C2');
    await frame.locator('#pocketReference').click();
    await frame.locator('[data-fill="git branch feature"]').click();
    await expect(frame.locator('#commandTextField')).toHaveValue('git branch feature');
    await frame.locator('#pocketAbout').click();
    const help = await frame.locator('#pocketDialogBody').innerText();
    if (locale !== 'zh-cn') expect(help.replace('简体中文', '')).not.toMatch(/[\u3400-\u9fff]/);
    await frame.locator('#pocketDialogClose').click();
    await page.locator('[data-git-close]').click();
    await expect(page.locator('[data-git-open]')).toHaveAttribute('aria-expanded', 'false');
  }
  await page.locator('.languages a[lang="en"]').click();
  await expect(page).toHaveURL(`${live}/en/${topic}`);
  await page.locator('[data-open-search]').click();
  await page.locator('#search-input').fill('Git');
  await expect(page.locator('#search-results a[href*="/learn/git-branching/"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(`${live}/learn/git-branching/`);
  await expect(page).toHaveURL(new RegExp(`/(zh-cn|en|fr)/${topic}$`));
  await page.goto(`${live}/en/learn/`);
  await expect(page.locator('a[href="/en/learn/git-branching/"]').first()).toBeVisible();
  expect((await page.request.get(`${live}/learn-assets/git-branching/simulator.html`)).headers()['x-frame-options']).toBe('SAMEORIGIN');
  expect((await page.request.get('/admin/')).headers()['x-frame-options']).toBe('DENY');
  expect(errors).toEqual([]);
});

test('authenticated preview keeps Git assets and language links inside preview', async ({ page, request }) => {
  expect((await request.get(previewPath, { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300);
  await page.request.post('/api/login', { data: { password: 'local-demo-password' } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(response.url()); });
  const prefix = new URL(previewPath, 'http://127.0.0.1:4521').pathname;
  const preview = new URL(previewPath, 'http://127.0.0.1:4521');
  await page.goto(preview.href);
  await page.goto(`${preview.origin}${prefix}en/${topic}`);
  await expect(page.locator('#git-stage iframe')).toHaveAttribute('src', `${prefix}learn-assets/git-branching/simulator.html?locale=en_US&NODEMO`);
  await page.locator('[data-git-open]').click();
  await expect(page.frameLocator('#git-stage iframe').locator('#pocketStartup')).toBeHidden({ timeout: 15000 });
  await page.locator('[data-git-close]').click();
  await page.locator('.languages a[lang="fr"]').click();
  await expect(page).toHaveURL(new RegExp(`${prefix}fr/${topic}$`));
  expect(errors).toEqual([]);
});

test('standalone Android fallback works offline without storage at narrow and keyboard sizes', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, offline: true });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Disabled', 'SecurityError'); } });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const file = pathToFileURL(path.resolve('apps/site/public/learn-assets/git-branching/simulator.html')).href;
  await page.goto(`${file}?locale=fr_FR`);
  await expect(page.locator('#pocketStartup')).toBeHidden();
  await expect(page.locator('#pocketStorageNotice')).toContainText('Mode temporaire');
  for (const [width, height] of [[320, 568], [390, 430], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => page.locator('#pocketRun').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  }
  await page.locator('#commandTextField').fill('git commit');
  await page.locator('#pocketRun').click();
  await expect(page.locator('#canvasHolder')).toContainText('C2');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#pocketAbout').click();
  await page.locator('#pocketImport').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from('{"intro1":{"solved":true,"best":false}}') });
  await expect(page.locator('#pocketProgress')).toContainText('1 niveaux');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#pocketExport').click();
  expect((await downloadEvent).suggestedFilename()).toBe('git-pocket-progress.json');
  expect(errors).toEqual([]);
  await context.close();
});
