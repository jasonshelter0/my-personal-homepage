import { test, expect } from '@playwright/test';
import version from '../../apps/site/src/content/ucit/version.json' with { type: 'json' };
let preview = '';
const live = 'http://127.0.0.1:4523';
test.beforeAll(async ({ request }) => {
  await request.post('/api/login', { data: { password: 'local-demo-password' } });
  const r = await (await request.post('/api/releases', { data: {} })).json();
  await expect
    .poll(
      async () => {
        const { releases } = await (await request.get('/api/releases')).json();
        return releases.find((item: { id: string }) => item.id === r.id)?.status;
      },
      { timeout: 90000 },
    )
    .toBe('ready');
  preview = r.previewUrl;
  expect((await request.get(preview)).ok()).toBeTruthy();
  expect((await request.post(`/api/releases/${r.id}/publish`, { data: {} })).ok()).toBeTruthy();
});
for (const mode of ['public', 'preview']) {
  test(`${mode}: UCIT three-language guide, search, reader and 320px layout`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => errors.push(r.url()));
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    if (mode === 'preview')
      await page.request.post('/api/login', { data: { password: 'local-demo-password' } });
    const entry = new URL(preview, 'http://127.0.0.1:4521');
    if (mode === 'preview') await page.goto(entry.href);
    const base = mode === 'public' ? `${live}/` : new URL(entry.pathname, entry.origin).href;
    const prefix = new URL(base).pathname;
    for (const locale of ['zh-cn', 'en', 'fr']) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${base}${locale}/projects/`);
      await expect(page.locator('.ucit-project-card img')).toHaveAttribute(
        'src',
        `${prefix}media/ucit-home.svg`,
      );
      await expect(page.locator('.ucit-project-card')).toHaveCSS(
        'border-top-color',
        'rgba(0, 0, 0, 0)',
      );
      await page.goto(`${base}${locale}/learn/`);
      await expect(page.locator('.learn-index-list .index-card')).toHaveCount(5);
      await expect(page.locator('.learn-placeholder')).toHaveCount(0);
      await page.setViewportSize({ width: 320, height: 740 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${base}${locale}/projects/`);
      await page.locator('.ucit-project-link').click();
      await expect(page).toHaveURL(`${base}${locale}/projects/ucit-home/`);
      await expect(page.locator('h1')).toHaveCount(1);
      if (locale === 'en' && mode === 'public')
        await page.screenshot({ path: '/tmp/ucit-guide-desktop.png' });
      await expect(page.locator('[data-ucit-version]')).toHaveAttribute(
        'data-ucit-version',
        version.pluginVersion,
      );
      await expect(page.locator('.ucit-section')).toHaveCount(7);
      await expect(page.locator('.reader-hub')).toHaveAttribute(
        'href',
        `${prefix}${locale}/projects/`,
      );
      await expect(page.locator('.reader-languages a[lang="fr"]')).toHaveAttribute(
        'href',
        `${prefix}fr/projects/ucit-home/`,
      );
      await page.locator('.ucit-state summary').first().focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.ucit-state').first()).toHaveAttribute('open', '');
      const toggle = page.locator('[data-reader-toggle]');
      if ((await toggle.getAttribute('aria-pressed')) === 'false') await toggle.click();
      await expect(page.locator('#site-profile')).toBeHidden();
      await page.keyboard.press('Control+k');
      await page.locator('#search-input').fill('UCIT');
      const result = page
        .locator(`#search-results a[href*="/${locale}/projects/ucit-home/"]`)
        .first();
      await expect(result).toBeVisible();
      expect(await result.getAttribute('href')).toContain(prefix);
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await page.setViewportSize({ width: 320, height: 740 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      if (locale === 'en' && mode === 'public')
        await page.screenshot({ path: '/tmp/ucit-guide-mobile.png' });
      await toggle.click();
      await expect(page.locator('#site-profile')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      await expect(page.locator('.ucit-copy')).toHaveCount(2);
      await expect(page.getByText('京ICP备2024092234号-1', { exact: true })).toBeVisible();
    }
    await page.locator('[data-reader-toggle]').click();
    await page.locator('.reader-languages a[lang="en"]').click();
    await expect(page).toHaveURL(`${base}en/projects/ucit-home/`);
    const meta = await (await page.request.get(`${base}projects/ucit-home/version.json`)).json();
    expect(meta.pluginVersion).toBe(version.pluginVersion);
    expect(meta.docsSha256).toBe(version.docsSha256);
    await page.goto(`${base}projects/ucit-home/`);
    await expect(page).toHaveURL(new RegExp('/(zh-cn|en|fr)/projects/ucit-home/$'));
    expect(meta.docsSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(errors).toEqual([]);
  });
}
