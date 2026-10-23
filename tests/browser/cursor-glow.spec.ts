import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

const live = 'http://127.0.0.1:4523';

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
