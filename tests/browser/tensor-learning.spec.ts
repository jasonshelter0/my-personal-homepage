import { test, expect } from '@playwright/test';
const ids = ['axes','broadcast','batch','flatten','squeeze','channel-bias','pool','linear','softmax'];
const solutions = ['y = x.permute(2, 0, 1)', 'means = x.mean(dim=1, keepdim=True)\ny = x - means', 'y = q @ k.transpose(-2, -1)', 'y = x.flatten(start_dim=1)', 'y = x.squeeze(-1)', 'y = x + bias.reshape(1, -1, 1, 1)', 'y = x.mean(dim=-1).mean(dim=-1)', 'y = x @ weight.transpose(-2, -1) + bias', 'y = scores.softmax(dim=-1)'];
const live = 'http://127.0.0.1:4523';
let preview: string;
test.beforeAll(async ({ request }) => {
  expect((await request.post('/api/login', { data: { password: 'local-demo-password' } })).ok()).toBeTruthy();
  const release = await (await request.post('/api/releases', { data: {} })).json();
  await expect.poll(async () => {
    const { releases } = await (await request.get('/api/releases')).json();
    return releases.find((r: { id: string }) => r.id === release.id)?.status;
  }, { timeout: 90000 }).toBe('ready');
  preview = release.previewUrl;
  expect((await request.get(preview)).ok()).toBeTruthy();
  expect((await request.post(`/api/releases/${release.id}/publish`, { data: {} })).ok()).toBeTruthy();
});

test('tensor lessons, trace, export, progress and keyboard dialog work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if(r.status() >= 400) errors.push(r.url()); });
  await page.goto(`${live}/en/learn/learnpytorch/`);
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-feedback]')).toHaveAttribute('data-kind', 'error');
  await expect(page.locator('.tl-mismatch').first()).toBeVisible();
  await page.locator('[data-tensor-lab] [data-hint]').click();
  await expect(page.locator('[data-hint-box]')).toBeVisible();
  for (let i=0; i<ids.length; i++) {
    await page.locator(`[data-lesson="${ids[i]}"]`).click();
    await page.locator('[data-run]').click();
    await expect(page.locator('[data-feedback]')).toHaveAttribute('data-kind', 'error');
    await page.locator('[data-editor]').fill(solutions[i]);
    await page.locator('[data-editor]').press('Control+Enter');
    await expect(page.locator('[data-success]')).toBeVisible();
    await page.locator('[data-target]').click();
    await expect(page.locator('[data-target]')).toHaveAttribute('aria-pressed','true');
    await page.locator('[data-step="0"]').click();
    await page.locator('[data-address]').first().click();
    await expect(page.locator('[data-cell-info]')).toContainText('→');
    await page.locator('[data-next]').click();
    await expect(page.locator(`[data-lesson="${ids[i+1] || 'sandbox'}"]`)).toHaveAttribute('aria-current','step');
  }
  await expect(page.locator('[data-progress]')).toContainText('9 / 9');
  await page.reload();
  await expect(page.locator('[data-progress]')).toContainText('9 / 9');
  await page.locator('[data-expand]').click();
  await expect(page.locator('[data-tensor-lab]')).toHaveAttribute('aria-modal','true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-expand]')).toBeFocused();
  await page.locator('[data-lesson="sandbox"]').click();
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-feedback]')).toHaveAttribute('data-kind','success');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-export]').click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toContain('import torch');
  await page.screenshot({path:'test-results/tensor-desktop.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('localized mobile pages, search, aliases and authenticated preview', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if(r.status() >= 400) errors.push(r.url()); });
  for (const locale of ['en','fr','zh-cn']) {
    await page.setViewportSize({width:320,height:800});
    await page.goto(`${live}/${locale}/learn/learnpytorch/`);
    await expect(page.locator('[data-address]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
    if(locale !== 'zh-cn') expect(await page.locator('.tensor-learning').innerText()).not.toMatch(/[\u3400-\u9fff]/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',new RegExp(`/${locale}/learn/learnpytorch/$`));
    await expect(page.locator('a[href="https://beian.miit.gov.cn/"]')).toHaveText('京ICP备2024092234号-1');
    for (let i=3; i<ids.length; i++) {
      await page.locator(`[data-lesson="${ids[i]}"]`).click();
      await page.locator('[data-editor]').fill(solutions[i]);
      await page.locator('[data-run]').click();
      await expect(page.locator('[data-success]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
    }
    await page.locator('[data-expand]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
    await page.keyboard.press('Escape');
  }
  await page.screenshot({path:'test-results/tensor-mobile.png',fullPage:true});
  await page.goto(`${live}/learn/learnpytorch/`);
  await expect(page).toHaveURL(/\/(zh-cn|en|fr)\/learn\/learnpytorch\/$/);
  await page.locator('.languages a[lang="en"]').click();
  await page.locator('[data-open-search]').click();
  await page.locator('#search-input').fill('LearnPyTorch');
  await expect(page.locator('#search-results a[href*="/learn/learnpytorch/"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(`${live}/en/learn/`);
  await expect(page.locator('a[href="/en/learn/learnpytorch/"]').first()).toBeVisible();
  await page.request.post('/api/login',{data:{password:'local-demo-password'}});
  const previewURL = new URL(preview, 'http://127.0.0.1:4521');
  await page.goto(previewURL.href);
  await page.goto(`${previewURL.origin}${previewURL.pathname}en/learn/learnpytorch/`);
  await expect(page.locator('[data-address]').first()).toBeVisible();
  await expect(page.locator('.languages a[lang="fr"]')).toHaveAttribute('href',`${previewURL.pathname}fr/learn/learnpytorch/`);
  await page.locator('[data-editor]').fill('y = x.permute(2, 0, 1)');
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-success]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('shared code loads and lessons work when browser storage is disabled', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window,'localStorage',{get(){throw new Error('Disabled');}}); });
  const code = 'y = x.permute(2, 0, 1)';
  await page.goto(`${live}/en/learn/learnpytorch/#tensor-axes?code=${Buffer.from(code).toString('base64url')}`);
  await expect(page.locator('[data-editor]')).toHaveValue(code);
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-success]')).toBeVisible();
  await expect(page.locator('[data-storage-notice]')).toBeVisible();
});


test('existing three-lesson progress survives expansion and new shared links round trip', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('learnpytorch-progress-v1',JSON.stringify(['axes','broadcast','batch','axes','unknown'])));
  const code = 'y = scores.softmax(dim=-1)';
  await page.goto(`${live}/en/learn/learnpytorch/#tensor-softmax?code=${Buffer.from(code).toString('base64url')}`);
  await expect(page.locator('[data-progress]')).toContainText('3 / 9');
  await expect(page.locator('[data-editor]')).toHaveValue(code);
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-success]')).toBeVisible();
  await expect(page.locator('[data-progress]')).toContainText('4 / 9');
  await page.locator('[data-next]').click();
  await expect(page.locator('[data-lesson="sandbox"]')).toHaveAttribute('aria-current','step');
  await page.goBack();
  await expect(page.locator('[data-lesson="softmax"]')).toHaveAttribute('aria-current','step');
  await expect(page.locator('[data-editor]')).toHaveValue(code);
});
