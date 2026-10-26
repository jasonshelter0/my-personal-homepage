import { test, expect, type Locator } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

test.use({ isMobile: true, hasTouch: true, viewport: { width: 320, height: 700 } });

async function collisions(svgs: Locator) {
  return svgs.evaluateAll(elements => {
    type Box = { x: number; y: number; w: number; h: number; id: string };
    const nodes: Box[] = [], refs: Box[] = [], labels: Box[] = [];
    for (const svg of elements) {
      if (+getComputedStyle(svg).opacity < .01) continue;
      for (const [selector, out] of [['[data-graph-node]', nodes], ['[data-graph-ref]', refs], ['[data-graph-label]', labels]] as const) {
        for (const e of svg.querySelectorAll<SVGElement>(selector)) {
          if (+(e.getAttribute('opacity') ?? 1) <= .05) continue;
          const r = e.getBoundingClientRect();
          out.push({ x: r.x, y: r.y, w: r.width, h: r.height, id: e.dataset.graphNode || e.dataset.graphRef || e.dataset.graphLabel || '' });
        }
      }
    }
    const overlap = (a: Box, b: Box) => a.x + .7 < b.x + b.w && b.x + .7 < a.x + a.w && a.y + .7 < b.y + b.h && b.y + .7 < a.y + a.h;
    const failures: string[] = [];
    if (!nodes.length) failures.push('missing nodes');
    nodes.forEach(node => refs.forEach(ref => { if (overlap(node, ref)) failures.push(`node ${node.id} / ref ${ref.id}`); }));
    for (const group of [nodes, refs, labels]) group.forEach((a, i) => group.slice(i + 1).forEach(b => { if (overlap(a, b)) failures.push(`${a.id} / ${b.id}`); }));
    return failures;
  });
}

for (const locale of ['zh_CN', 'en_US', 'fr_FR']) {
  test(`dense Git graphs stay separated and support zoom, pan and ref taps (${locale})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const url = pathToFileURL(path.resolve('apps/site/public/learn-assets/git-branching/simulator.html'));
    url.search = `locale=${locale}&NODEMO`;
    await page.goto(url.href);
    await expect(page.locator('#pocketStartup')).toBeHidden();
    const command = async (text: string) => {
      await page.locator('#commandTextField').fill(text);
      await page.locator('#pocketRun').click();
      // Upstream commands animate and are queued; wait for their settled layout.
      await page.waitForTimeout(1800);
    };
    const panel = page.locator('.canvasTerminalHolder');
    for (const level of ['rampup1', 'mixed4', 'remoteAdvanced5']) {
      await command(`level ${level} --noIntroDialog --noStartCommand;show goal`);
      await expect(panel.locator('svg').first()).toBeVisible();
      await expect.poll(() => collisions(page.locator('#canvasHolder > svg'))).toEqual([]);
      await expect.poll(() => collisions(panel.locator('svg'))).toEqual([]);
    }
    const svg = panel.locator('svg').first(), tools = panel.locator('.pocket-graph-tools');
    const fit = await svg.getAttribute('viewBox');
    await tools.locator('button').nth(1).click();
    const zoomed = await svg.getAttribute('viewBox');
    expect(zoomed).not.toBe(fit);
    const box = (await panel.locator('.inside').boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 80, { steps: 8 });
    await page.mouse.up();
    expect(await svg.getAttribute('viewBox')).not.toBe(zoomed);
    await tools.locator('button').nth(2).click();
    expect(await svg.getAttribute('viewBox')).toBe(fit);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(() => collisions(panel.locator('svg'))).toEqual([]);
    await page.setViewportSize({ width: 320, height: 700 });
    await command('hide goal');
    await expect(panel).toHaveCount(0);
    await command('show goal');
    await expect(panel.locator('.pocket-graph-tools')).toHaveCount(1);
    await expect.poll(() => collisions(panel.locator('svg'))).toEqual([]);
    await panel.locator('.toolbar .close').click();
    await expect(panel).toHaveCount(0);
    await command('exit level');
    await command('git branch pocket');
    const branch = page.locator('#canvasHolder [data-graph-label="pocket"]').last();
    await branch.click();
    await expect(branch).toHaveText('pocket*');
    await command('git commit');
    await expect(page.locator('#canvasHolder [data-graph-node="C2"]').last()).toBeVisible();
    if (locale === 'zh_CN') {
      const stage = (await page.locator('#mainVisSpace').boundingBox())!;
      const cdp = await page.context().newCDPSession(page);
      const y = stage.y + Math.min(100, stage.height / 3);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 110, y }, { x: 180, y: y + 30 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 70, y: y - 10 }, { x: 220, y: y + 40 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const mainTools = page.locator('.pocket-graph-tools[data-graph-main]:visible');
      expect(Number(await mainTools.getAttribute('data-zoom'))).toBeGreaterThan(1);
      await mainTools.locator('button').nth(2).click();
      await expect(mainTools).toHaveAttribute('data-zoom', '1');
    }
    expect(errors).toEqual([]);
  });
}
