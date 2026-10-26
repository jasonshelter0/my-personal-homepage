import { test, expect } from '@playwright/test';
const live = 'http://127.0.0.1:4523',
  route = '/en/learn/learnpytorch/attention/';
const ids = ['scores', 'scale', 'axis', 'causal', 'values', 'capstone'];
let preview: string;
test.beforeAll(async ({ request }) => {
  expect(
    (await request.post('/api/login', { data: { password: 'local-demo-password' } })).ok(),
  ).toBeTruthy();
  const release = await (await request.post('/api/releases', { data: {} })).json();
  await expect
    .poll(
      async () => {
        const { releases } = await (await request.get('/api/releases')).json();
        return releases.find((r: { id: string }) => r.id === release.id)?.status;
      },
      { timeout: 90000 },
    )
    .toBe('ready');
  preview = release.previewUrl;
  expect((await request.get(preview)).ok()).toBeTruthy();
  expect(
    (await request.post(`/api/releases/${release.id}/publish`, { data: {} })).ok(),
  ).toBeTruthy();
});
async function repair(page: any, id: string) {
  await page.locator('[data-at-setting="orientation"]').selectOption('qk');
  await page.locator('[data-at-setting="scale"]').check();
  await page.locator('[data-at-setting="axis"]').selectOption('-1');
  await page.locator('[data-at-setting="values"]').selectOption('v');
  await page.locator('[data-at-setting="causal"]').setChecked(['causal', 'capstone'].includes(id));
}
test('six attention challenges reject mistakes and expose meaningful intermediate results', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(live + route);
  for (const id of ids) {
    await page.locator(`[data-at-mission="${id}"]`).click();
    await page.locator('[data-at-check]').click();
    await expect(page.locator('[data-at-feedback]')).toHaveAttribute('data-kind', 'error');
    await repair(page, id);
    await page.locator('[data-at-check]').click();
    await expect(page.locator('[data-at-success]')).toBeVisible();
    await page.locator('[data-at-stage="weights"]').click();
    await page.locator('[data-at-cell="1,0"]').click();
    await expect(page.locator('[data-at-row-sum]')).toContainText(': 1');
    await expect(page.locator('[data-at-inspector]')).toContainText('Dot-product terms');
  }
  await expect(page.locator('[data-at-progress]')).toContainText('6 / 6');
  await expect(page.locator('[data-pt-progress]')).toContainText('6 / 19');
  await page.reload();
  await expect(page.locator('[data-at-progress]')).toContainText('6 / 6');
  await page.locator('[data-at-mission="causal"]').click();
  await page.locator('[data-at-probe]').click();
  await expect(page.locator('[data-at-probe-result]')).not.toContainText('change: 0');
  await page.locator('[data-at-setting="causal"]').check();
  await page.locator('[data-at-probe]').click();
  await expect(page.locator('[data-at-probe-result]')).toContainText('change: 0');
  await expect(page.locator('[data-at-cell="0,3"]')).toHaveAttribute('data-value', '0');
  await page.locator('[data-at-cell="0,3"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-at-cell="0,3"]')).toBeFocused();
  await expect(page.locator('[data-at-inspector]')).toContainText('Blocked');
  await page.screenshot({ path: 'test-results/attention-causal.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('shared experiments reproduce controls and generate PNG and Python downloads', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(live + route + '#attention-capstone');
  await repair(page, 'capstone');
  await page.locator('[data-at-example]').selectOption({ value: '2' });
  await page.locator('[data-at-temperature]').fill('0.5');
  await page.locator('[data-at-cell="2,1"]').click();
  await page.locator('[data-at-share]').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain('#attention-capstone?');
  await page.goto(link);
  await expect(page.locator('[data-at-example]')).toHaveValue('2');
  await expect(page.locator('[data-at-temperature]')).toHaveValue('0.5');
  await expect(page.locator('[data-at-setting="causal"]')).toBeChecked();
  await expect(page.locator('[data-at-inspector]')).toContainText('Query token C → Key token B');
  const python = page.waitForEvent('download');
  await page.locator('[data-at-export]').click();
  const stream = await (await python).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const source = Buffer.concat(chunks).toString();
  expect(source).toContain('masked_fill');
  expect(source).toContain('* 0.5');
  const png = page.waitForEvent('download');
  await page.locator('[data-at-card]').click();
  const download = await png;
  await download.saveAs('test-results/attention-card.png');
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const bytes: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) bytes.push(chunk);
  const image = Buffer.concat(bytes);
  expect(image.subarray(1, 4).toString()).toBe('PNG');
  expect(image.readUInt32BE(16)).toBe(1200);
  expect(image.readUInt32BE(20)).toBe(720);
  await page.goto(live + route + '#attention-axis?v=oops');
  await expect(page.locator('[data-at-feedback]')).toContainText('invalid');
  await expect(page.locator('[data-at-cell="0,0"]')).toBeVisible();
});
test('course map resumes across chapters and autograd deep links support browser history', async ({
  page,
}) => {
  await page.goto(live + '/en/learn/learnpytorch/autograd/#autograd-detach');
  await expect(page.locator('[data-ag-mission="detach"]')).toHaveAttribute('aria-current', 'step');
  await page.locator('[data-ag-detach]').uncheck();
  await page.locator('[data-ag-backward]').click();
  await page.locator('[data-ag-all]').click();
  await page.locator('[data-ag-check]').click();
  await expect(page.locator('[data-pt-progress]')).toContainText('1 / 19');
  await page.locator('[data-ag-next-mission]').click();
  await expect(page).toHaveURL(/#autograd-accumulation$/);
  await page.goBack();
  await expect(page.locator('[data-ag-mission="detach"]')).toHaveAttribute('aria-current', 'step');
  await page.goto(live + route + '#attention-causal');
  await page.goto(live + '/en/learn/');
  await expect(page.locator('[data-pt-resume]')).toHaveAttribute(
    'href',
    live + route + '#attention-causal',
  );
  await page.locator('[data-pt-resume]').click();
  await expect(page.locator('[data-at-mission="causal"]')).toHaveAttribute('aria-current', 'step');
  await page.locator('.pt-map summary').click();
  await expect(page.locator('[data-pt-link]')).toHaveCount(19);
});
test('all locales work at 320px, have social cards, search and production-style preview links', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  for (const locale of ['en', 'fr', 'zh-cn']) {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${live}/${locale}/learn/learnpytorch/attention/`);
    await expect(page.locator('[data-at-cell="0,0"]')).toBeVisible();
    if (locale !== 'zh-cn')
      expect(await page.locator('.attention-learning').innerText()).not.toMatch(/[\u3400-\u9fff]/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      new RegExp(`/social-${locale}.png$`),
    );
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      new RegExp(`/${locale}/learn/learnpytorch/attention/$`),
    );
    await page.locator('[data-at-mission="capstone"]').click();
    await repair(page, 'capstone');
    await page.locator('[data-at-check]').click();
    await expect(page.locator('[data-at-success]')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
  }
  await page.screenshot({ path: 'test-results/attention-mobile.png', fullPage: true });
  await page.goto(live + '/learn/learnpytorch/attention/');
  await expect(page).toHaveURL(/\/(en|fr|zh-cn)\/learn\/learnpytorch\/attention\/$/);
  await page.locator('.languages a[lang=en]').click();
  await page.waitForLoadState('load');
  await page.locator('[data-at-cell="0,0"]').waitFor();
  await page.locator('[data-open-search]').first().click();
  await page.locator('#search-input').fill('attention');
  await expect(
    page.locator('#search-results a[href*="/learnpytorch/attention/"]').first(),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.request.post('/api/login', { data: { password: 'local-demo-password' } });
  const url = new URL(preview, 'http://127.0.0.1:4521');
  await page.goto(url.href);
  await page.goto(`${url.origin}${url.pathname}en/learn/learnpytorch/attention/`);
  await expect(page.locator('[data-at-cell="0,0"]')).toBeVisible();
  await expect(page.locator('.languages a[lang=fr]')).toHaveAttribute(
    'href',
    `${url.pathname}fr/learn/learnpytorch/attention/`,
  );
  await expect(page.locator('[data-pt-resume]')).toHaveAttribute(
    'href',
    new RegExp(url.pathname + 'en/learn/learnpytorch/attention/#attention-scores$'),
  );
  expect(errors).toEqual([]);
});
test('clipboard denial, storage denial and fullscreen remain usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw Error('disabled');
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(Error('denied')) },
    });
  });
  await page.goto(live + route + '#attention-causal');
  await page.locator('[data-at-share]').click();
  await expect(page.locator('[data-at-share-url]')).toBeVisible();
  await expect(page.locator('[data-at-storage]')).toBeVisible();
  await repair(page, 'causal');
  await page.locator('[data-at-check]').click();
  await expect(page.locator('[data-pt-progress]')).toContainText('1 / 19');
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.locator('[data-reader-fullscreen]').click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBeTruthy();
  await page.locator('[data-at-cell="0,2"]').click();
  await page.screenshot({ path: 'test-results/attention-fullscreen.png' });
  await page.locator('[data-reader-fullscreen]').click();
  await page.locator('[data-reader-toggle]').click();
  await expect(page.locator('.profile-panel')).toBeVisible();
});
