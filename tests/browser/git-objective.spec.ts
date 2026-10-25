import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Inspect the panel and SVG themselves: document overflow is hidden by the app,
// so a page-level scrollWidth assertion cannot catch the old 400px minimum.
for (const locale of ['zh_CN', 'en_US', 'fr_FR']) {
  test(`Git goals and objectives fit after resize and reopening (${locale})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    const file = pathToFileURL(path.resolve('apps/site/public/learn-assets/git-branching/simulator.html'));
    file.searchParams.set('locale', locale);
    await page.goto(file.href);
    await expect(page.locator('#pocketStartup')).toBeHidden();
    await page.locator('#commandTextField').fill('level remoteAdvanced5 --noIntroDialog --noStartCommand;show goal');
    await page.locator('#pocketRun').click();
    const panel = page.locator('.canvasTerminalHolder > .terminal-window-holder');
    await expect(panel.locator('.inside svg').first()).toBeVisible();
    async function fits() {
      await expect.poll(async () => panel.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const graph = el.querySelector<HTMLElement>('.inside')!;
        const svgs = [...graph.querySelectorAll('svg')];
        return box.width > 0 && box.left >= 0 && box.right <= innerWidth + 1
          && el.scrollWidth <= el.clientWidth + 1
          && svgs.length > 0 && svgs.every(svg => Number(svg.getAttribute('width')) <= graph.clientWidth + 1);
      })).toBeTruthy();
    }
    await fits();
    // Landscape can persist an inline width when the window is hidden.
    await page.setViewportSize({ width: 844, height: 390 });
    await fits();
    await page.locator('#commandTextField').fill('hide goal');
    await page.locator('#pocketRun').click();
    await expect(page.locator('.canvasTerminalHolder')).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('#commandTextField').fill('show goal');
    await page.locator('#pocketRun').click();
    await expect(panel.locator('.inside svg').first()).toBeVisible();
    await fits();
    const close = panel.locator('.toolbar .close');
    await expect(close).toBeVisible();
    await close.click();
    await expect(page.locator('.canvasTerminalHolder')).toHaveCount(0);
    await page.locator('#commandTextField').fill('objective');
    await page.locator('#pocketRun').click();
    const objective = page.locator('.modalView.show .inside');
    await expect(objective).toBeVisible();
    await expect.poll(async () => objective.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth + 1 && el.scrollWidth <= el.clientWidth + 1;
    })).toBeTruthy();
    await expect(page.locator('.modalView.show .right button')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
