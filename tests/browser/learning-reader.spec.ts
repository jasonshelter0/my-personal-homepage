import { test, expect } from '@playwright/test';
const live = 'http://127.0.0.1:4523';
let preview = '';
test.beforeAll(async ({ request }) => {
  await request.post('/api/login', { data: { password: 'local-demo-password' } });
  const release = await (await request.post('/api/releases', { data: {} })).json();
  await expect.poll(async () => {
    const { releases } = await (await request.get('/api/releases')).json();
    return releases.find((item: { id: string }) => item.id === release.id)?.status;
  }, { timeout: 90000 }).toBe('ready');
  preview = release.previewUrl;
  expect((await request.get(preview)).ok()).toBeTruthy();
  expect((await request.post(`/api/releases/${release.id}/publish`, { data: {} })).ok()).toBeTruthy();
});

test('large-screen reading expands the course, preserves navigation and supports real fullscreen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto(`${live}/en/learn/mamba-tta-irstd/tent/`);
  const original = (await page.locator('main').boundingBox())!.width;
  const toggle = page.locator('[data-reader-toggle]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#site-profile')).toBeHidden();
  const expanded = (await page.locator('main').boundingBox())!.width;
  expect(expanded).toBeGreaterThan(original * 1.8);
  expect(expanded).toBeGreaterThan(1050);
  expect(expanded).toBeLessThan(1281);
  await page.locator('[data-reader-search]').click();
  await page.locator('#search-input').fill('Mamba');
  await expect(page.locator('#search-results a[href*="mamba-tta-irstd"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#search-dialog')).not.toBeVisible();
  await page.locator('.reader-languages a[lang="fr"]').click();
  await page.waitForLoadState('load');
  await expect(page.locator('[data-reader-label]')).toHaveText('Quitter le mode immersif');
  await expect(page.locator('#site-profile')).toBeHidden();
  await page.locator('[data-reader-fullscreen]').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  await expect(page.locator('[data-fullscreen-label]')).toHaveText('Quitter le plein écran');
  await page.locator('[data-reader-fullscreen]').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#site-profile')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  for (const locale of ['zh-cn', 'en', 'fr']) {
    for (const course of ['mamba-tta-irstd', 'git-branching', 'learnpytorch']) {
      await page.goto(`${live}/${locale}/learn/${course}/`);
      if (await toggle.getAttribute('aria-pressed') === 'false') await toggle.click();
      await expect(page.locator('#site-profile')).toBeHidden();
      await expect(page.locator('.reader-hub')).toHaveAttribute('href', `/${locale}/learn/`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
  }
  await page.goto(`${live}/en/`);
  await expect(page.locator('#site-profile')).toBeVisible();
  await expect(page.locator('[data-learning-reader]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('phone and unavailable storage/fullscreen retain a usable reading mode and exit', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    Object.defineProperty(document, 'fullscreenEnabled', { value: true });
    Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  });
  for (const locale of ['zh-cn', 'en', 'fr']) {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`${live}/${locale}/learn/mamba-tta-irstd/tent/`);
    await page.locator('[data-reader-fullscreen]').click();
    await expect(page.locator('#site-profile')).toBeHidden();
    await expect(page.locator('[data-reader-status]')).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.locator('[data-reader-toggle]').click();
    await expect(page.locator('#site-profile')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('reader links and search retain authenticated preview paths', async ({ page }) => {
  await page.request.post('/api/login', { data: { password: 'local-demo-password' } });
  const entry = new URL(preview, 'http://127.0.0.1:4521');
  await page.goto(entry.href);
  const base = new URL(entry.pathname, entry.origin);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${base}en/learn/mamba-tta-irstd/`);
  await page.locator('[data-reader-toggle]').click();
  await page.locator('.reader-languages a[lang="fr"]').click();
  await page.waitForLoadState('load');
  await expect(page).toHaveURL(`${base}fr/learn/mamba-tta-irstd/`);
  await expect(page.locator('#site-profile')).toBeHidden();
  await page.locator('[data-reader-search]').click();
  await page.locator('#search-input').fill('Mamba');
  const result = page.locator('#search-results a[href*="mamba-tta-irstd"]').first();
  await expect(result).toBeVisible();
  expect(await result.getAttribute('href')).toContain(base.pathname);
  await page.keyboard.press('Escape');
  await page.locator('.reader-hub').click();
  await page.waitForLoadState('load');
  await expect(page).toHaveURL(`${base}fr/learn/`);
  await expect(page.locator('#site-profile')).toBeHidden();
  await expect(page.locator('link[rel="canonical"]')).not.toHaveAttribute('href', /preview/);
});
