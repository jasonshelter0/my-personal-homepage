import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

const live = 'http://127.0.0.1:4523';

for (const [platform, shortcut, key, aria] of [
  ['Win32', 'Ctrl + K', 'Control+k', 'Control+k'],
  ['Linux x86_64', 'Ctrl + K', 'Control+k', 'Control+k'],
  ['MacIntel', '⌘ K', 'Meta+k', 'Meta+k'],
]) {
  test(`search shortcut matches ${platform} and opens localized search`, async ({ page }) => {
    await page.addInitScript(
      (platform) => Object.defineProperty(navigator, 'platform', { get: () => platform }),
      platform,
    );
    for (const locale of ['zh-cn', 'en', 'fr']) {
      await page.goto(`${live}/${locale}/`);
      await expect(page.locator('[data-search-shortcut]')).toHaveText(shortcut);
      await expect(page.locator('[data-open-search]')).toHaveAttribute('aria-keyshortcuts', aria);
      await page.keyboard.press(key);
      await expect(page.locator('#search-dialog')).toBeVisible();
      await expect(page.locator('#search-input')).toBeFocused();
      await expect(page.locator('.search-shortcut')).toContainText(shortcut);
      await expect(page.locator('.search-shortcut')).not.toContainText('Ctrl / ⌘');
      await page.keyboard.press(key);
      await expect(page.locator('#search-dialog')).not.toBeVisible();
      await page.keyboard.press(key);
      await page.keyboard.press('Escape');
      await expect(page.locator('#search-dialog')).not.toBeVisible();
    }
  });
}

test.beforeAll(async ({ request }) => {
  expect(
    (await request.post('/api/login', { data: { password: 'local-demo-password' } })).ok(),
  ).toBeTruthy();
  const response = await request.post('/api/releases', { data: {} });
  expect(response.status()).toBe(202);
  const release = await response.json();
  await expect
    .poll(
      async () => {
        const { releases } = await (await request.get('/api/releases')).json();
        return releases.find((r: { id: string }) => r.id === release.id)?.status;
      },
      { timeout: 60000 },
    )
    .toBe('ready');
  expect((await request.get(release.previewUrl)).ok()).toBeTruthy();
  expect(
    (await request.post(`/api/releases/${release.id}/publish`, { data: {} })).ok(),
  ).toBeTruthy();
});

async function moveGlow(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await expect(page.locator('.cursor-glow')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('.cursor-glow')).toHaveCSS('opacity', '1');
  await expect
    .poll(() =>
      page
        .locator('.cursor-glow')
        .evaluate((el) => [
          el.style.getPropertyValue('--mouse-x'),
          el.style.getPropertyValue('--mouse-y'),
        ]),
    )
    .toEqual([`${x}px`, `${y}px`]);
}

async function pixel(page: Page) {
  return [
    ...(await sharp(await page.screenshot())
      .extract({ left: 8, top: 300, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()),
  ];
}

test('admin glow appears on login and previews draft theme and radius without blocking editing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/');
  await moveGlow(page, 8, 300);
  const near = await pixel(page);
  await moveGlow(page, 1400, 300);
  const far = await pixel(page);
  expect(near.reduce((sum, value, i) => sum + value - far[i], 0)).toBeGreaterThan(40);
  await page.getByLabel('密码', { exact: true }).fill('local-demo-password');
  await page.getByRole('button', { name: '登录工作室' }).click();
  await page.getByRole('combobox', { name: '界面语言', exact: true }).selectOption('en');
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Appearance/ })
    .click();
  const glow = page.locator('.cursor-glow');
  await moveGlow(page, 8, 300);
  const workspaceNear = await pixel(page);
  await moveGlow(page, 1400, 300);
  const workspaceFar = await pixel(page);
  expect(workspaceNear.reduce((sum, value, i) => sum + value - workspaceFar[i], 0)).toBeGreaterThan(
    40,
  );
  await expect(glow).toHaveCSS('pointer-events', 'none');
  const initialColor = await glow.evaluate((el) => el.style.getPropertyValue('--glow-rgb'));
  await page.getByRole('button', { name: /Violet/ }).click();
  await expect
    .poll(() => glow.evaluate((el) => el.style.getPropertyValue('--glow-rgb')))
    .not.toBe(initialColor);
  const radius = page.getByRole('spinbutton', { name: 'Cursor glow radius', exact: true });
  await radius.fill('320');
  await expect(glow).toHaveCSS('background-image', /^radial-gradient\(320px /);
  await radius.focus();
  await moveGlow(page, 8, 300);
  await expect(radius).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await moveGlow(page, 80, 400);
  await expect(glow).toHaveCSS('transition-duration', '0s');
  // Preview the local draft immediately; neither the saved draft nor public
  // release changes until the owner explicitly saves and publishes it.
  const saved = await (await page.request.get('/api/snapshot')).json();
  expect(saved.settings.cursorGlowRadius).toBe(600);
  expect(saved.settings.accent).toBe('#5eead4');
  expect(await (await page.request.get(`${live}/en/`)).text()).toContain('--glow-radius:600px');
  await page.getByRole('button', { name: 'Reset to 600 px', exact: true }).click();
  await expect(glow).toHaveCSS('background-image', /^radial-gradient\(600px /);
  await page.setViewportSize({ width: 390, height: 844 });
  await moveGlow(page, 8, 300);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy();
  await page.locator('body').dispatchEvent('touchstart');
  await page.locator('body').dispatchEvent('mousemove', { clientX: 8, clientY: 300 });
  await expect(glow).toHaveCSS('opacity', '0');
});

test('mouse glow visibly follows the pointer across languages, pages and scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const locale of ['zh-cn', 'en', 'fr']) {
      for (const route of ['', 'posts/a-smaller-web/']) {
        await page.goto(`${live}/${locale}/${route}`);
        await moveGlow(page, 8, 300);
        const near = await pixel(page);
        await moveGlow(page, 1400, 300);
        const far = await pixel(page);
        // Compare painted pixels under both preferences, matching the reference
        // site's direct mouse tracking even when reduced motion is requested.
        expect(near.reduce((sum, value, i) => sum + value - far[i], 0)).toBeGreaterThan(40);
      }
    }
  }
  // Mouse-only event sources must work without requiring pointerType metadata.
  await page.locator('body').dispatchEvent('mousemove', { clientX: 80, clientY: 200 });
  await expect
    .poll(() =>
      page.locator('.cursor-glow').evaluate((el) => el.style.getPropertyValue('--mouse-x')),
    )
    .toBe('80px');
  await page.evaluate(() => window.scrollTo(0, 500));
  await moveGlow(page, 8, 300);
  expect(await page.locator('.cursor-glow').boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 1440,
    height: 900,
  });
  await page.goto(`${live}/en/`);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#search-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-dialog')).not.toBeVisible();
});

test('narrow windows and reduced motion retain mouse tracking; touch does not activate glow', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${live}/en/`);
  await moveGlow(page, 8, 300);
  await expect(page.locator('.cursor-glow')).toHaveCSS('opacity', '1');
  await expect(page.locator('.cursor-glow')).toHaveCSS('display', 'block');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await moveGlow(page, 80, 400);
  await expect(page.locator('.cursor-glow')).toHaveCSS('display', 'block');
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await moveGlow(page, 8, 300);
  await page
    .locator('body')
    .dispatchEvent('pointerout', { pointerType: 'mouse', relatedTarget: null });
  await expect(page.locator('.cursor-glow')).toHaveCSS('opacity', '0');

  const touchContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`${live}/fr/`);
  await touchPage.touchscreen.tap(8, 300);
  await touchPage.locator('body').dispatchEvent('mousemove', { clientX: 8, clientY: 300 });
  await expect(touchPage.locator('.cursor-glow')).toHaveCSS('opacity', '0');
  await touchContext.close();
});
