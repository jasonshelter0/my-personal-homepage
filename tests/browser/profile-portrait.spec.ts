import { test, expect } from '@playwright/test';

test('optional portrait survives preview and publication with a square responsive crop', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await page.request.post('/api/login', { data: { password: 'local-demo-password' } });
  const original = await (await page.request.get('/api/snapshot')).json();
  const build = async () => {
    const response = await page.request.post('/api/releases', { data: {} });
    expect(response.status()).toBe(202);
    const release = await response.json();
    await expect
      .poll(
        async () => {
          const { releases } = await (await page.request.get('/api/releases')).json();
          return releases.find((r: { id: string }) => r.id === release.id)?.status;
        },
        { timeout: 90000 },
      )
      .toBe('ready');
    return release;
  };
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    let draft = await (await page.request.get('/api/snapshot')).json();
    draft.settings.avatarId = null;
    expect((await page.request.put('/api/snapshot', { data: draft })).ok()).toBeTruthy();
    const empty = await build();
    await page.goto(empty.previewUrl);
    await expect(page.locator('.profile-portrait')).toHaveCount(0);
    await expect(page.locator('.profile-panel--with-portrait')).toHaveCount(0);
    expect(
      (await page.request.post(`/api/releases/${empty.id}/publish`, { data: {} })).ok(),
    ).toBeTruthy();

    draft = await (await page.request.get('/api/snapshot')).json();
    // Deliberately use a landscape fixture to exercise square cropping.
    const portrait = draft.media.find((m: { id: string }) => m.id === 'atlas');
    draft.settings.avatarId = portrait.id;
    expect((await page.request.put('/api/snapshot', { data: draft })).ok()).toBeTruthy();
    const selected = await build();
    await page.goto('http://127.0.0.1:4523/en/');
    await expect(page.locator('.profile-portrait')).toHaveCount(0);
    const previewRoot = new URL(selected.previewUrl).origin;
    await page.goto(selected.previewUrl);
    for (const [locale, language] of [
      ['zh-cn', 'zh-CN'],
      ['en', 'en'],
      ['fr', 'fr'],
    ]) {
      await page.goto(`${previewRoot}/${locale}/`);
      await expect(page.locator('.avatar')).toHaveAttribute('alt', portrait.alt[language]);
      await expect(page.locator('.avatar')).toHaveCSS('object-fit', 'cover');
      expect(
        await page
          .locator('.avatar')
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      ).toBeTruthy();
      for (const viewport of [
        { width: 1440, height: 1050 },
        { width: 1280, height: 720 },
        { width: 390, height: 844 },
        { width: 320, height: 640 },
      ]) {
        await page.setViewportSize(viewport);
        const frame = await page.locator('.profile-portrait').boundingBox();
        const photo = await page.locator('.avatar').boundingBox();
        expect(Math.abs(frame!.width - frame!.height)).toBeLessThan(1);
        expect(Math.abs(photo!.width - photo!.height)).toBeLessThan(1);
        expect(frame!.width).toBe(viewport.width <= 760 ? 104 : 128);
        if (viewport.height === 1050) {
          const panel = await page.locator('.profile-panel').boundingBox();
          expect(panel!.height).toBeLessThanOrEqual(viewport.height);
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        const name = await page.locator('.profile-name').boundingBox();
        expect(frame!.y + frame!.height).toBeLessThan(name!.y);
      }
    }
    await page.screenshot({ path: testInfo.outputPath('portrait-mobile.png'), fullPage: true });
    const borderBefore = await page
      .locator('.profile-portrait')
      .evaluate((el) => getComputedStyle(el).borderTopColor);
    await page.evaluate(() => document.documentElement.style.setProperty('--accent', '#c4b5fd'));
    await expect
      .poll(() =>
        page.locator('.profile-portrait').evaluate((el) => getComputedStyle(el).borderTopColor),
      )
      .not.toBe(borderBefore);
    expect(
      (await page.request.post(`/api/releases/${selected.id}/publish`, { data: {} })).ok(),
    ).toBeTruthy();
    await page.goto('http://127.0.0.1:4523/en/');
    await expect(page.locator('.profile-portrait')).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.screenshot({ path: testInfo.outputPath('portrait-desktop.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    const current = await (await page.request.get('/api/snapshot')).json();
    original.revision = current.revision;
    expect((await page.request.put('/api/snapshot', { data: original })).ok()).toBeTruthy();
  }
});
