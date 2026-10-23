import { test, expect } from '@playwright/test';
test('complete editorial journey, multilingual static search and responsive layout', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/admin/');
  await page.getByLabel('密码', { exact: true }).fill('local-demo-password');
  await page.getByRole('button', { name: '登录工作室' }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来。' })).toBeVisible();
  await page.getByRole('combobox', { name: '界面语言', exact: true }).selectOption('en');
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Profile/ })
    .click();
  const headline = page.getByLabel('Role / headline', { exact: true });
  await headline.click();
  await headline.press('End');
  await headline.pressSequentially(' TEST', { delay: 40 });
  await expect(headline).toBeFocused();
  await expect(headline).toHaveValue(/TEST$/);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Profile/ })
    .click();
  await expect(page.getByLabel('Role / headline', { exact: true })).toHaveValue(/TEST$/);
  // Restore full seed via API; UI persistence and focus were checked above.
  const snapshot = await (await page.request.get('/api/snapshot')).json();
  snapshot.settings.profile['zh-CN'].headline = snapshot.settings.profile['zh-CN'].headline.replace(
    / TEST$/,
    '',
  );
  expect((await page.request.put('/api/snapshot', { data: snapshot })).ok()).toBeTruthy();
  for (const locale of ['zh-CN', 'en', 'fr'])
    expect(
      (await page.request.post('/api/review', { data: { profile: true, locale } })).ok(),
    ).toBeTruthy();
  await page.reload();
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Preview & publish/ })
    .click();
  await expect(page.getByText('Checks passed', { exact: true })).toBeVisible();
  const createdResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/releases') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Create release preview/ }).click();
  const created = await (await createdResponse).json();
  const newReleaseRow = page.locator('.release-row').filter({ hasText: created.id });
  await expect(newReleaseRow.getByRole('link', { name: /Open preview/ })).toBeVisible({
    timeout: 60000,
  });
  const [preview] = await Promise.all([
    context.waitForEvent('page'),
    newReleaseRow.getByRole('link', { name: /Open preview/ }).click(),
  ]);
  await preview.waitForLoadState();
  await expect(preview.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await preview.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(preview.locator('html')).toHaveAttribute('lang', 'en');
  await expect(preview.locator('body')).toContainText('Developer, researcher');
  await preview.getByRole('button', { name: 'Search', exact: true }).click();
  await preview.getByRole('searchbox').fill('Atlas');
  await expect(preview.locator('#search-results a').first()).toBeVisible();
  await preview.keyboard.press('Escape');
  await expect(preview.locator('#search-dialog')).not.toBeVisible();
  await preview.goto('http://127.0.0.1:4522/fr/posts/a-smaller-web/');
  await expect(preview.locator('h1')).toContainText('Construire');
  await preview.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(preview).toHaveURL(/\/en\/posts\/a-smaller-web\/$/);
  await preview.goto('http://127.0.0.1:4522/zh-cn/');
  await preview.getByRole('button', { name: '搜索', exact: true }).click();
  await preview.getByRole('searchbox').fill('学习');
  await expect(preview.locator('#search-results a').first()).toBeVisible();
  await preview.keyboard.press('Escape');
  await newReleaseRow.getByRole('button', { name: 'Publish this version', exact: true }).click();
  await expect(page.getByText('Current live version', { exact: true })).toBeVisible();
  const live = await context.newPage();
  await live.goto('http://127.0.0.1:4523/en/');
  await expect(live.locator('body')).toContainText('Atlas');
  const privateContext = await context.browser()!.newContext();
  const outsider = await privateContext.newPage();
  const blocked = await outsider.goto('http://127.0.0.1:4522/');
  expect(blocked?.status()).toBe(401);
  await outsider.goto('http://127.0.0.1:4523/fr/');
  await expect(outsider.locator('html')).toHaveAttribute('lang', 'fr');
  await privateContext.close();
  // Theme save stays private until a new immutable version is built and published.
  const theme = () =>
    live.evaluate(() =>
      ['--accent', '--background'].map((key) =>
        document.documentElement.style.getPropertyValue(key),
      ),
    );
  const before = await theme();
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Appearance/ })
    .click();
  await page.getByRole('button', { name: /Violet/ }).click();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await live.reload();
  expect(await theme()).toEqual(before);
  await live.setViewportSize({ width: 390, height: 844 });
  await live.goto('http://127.0.0.1:4523/fr/');
  expect(
    await live.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy();
  await expect(live.getByRole('button', { name: 'Rechercher', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test('author and upload in three languages, publish a new article, restore a previous version', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => localStorage.setItem('studio-language', 'en'));
  await page.goto('/admin/');
  await page.getByLabel('Password', { exact: true }).fill('local-demo-password');
  await page.getByRole('button', { name: /Enter your studio/ }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  const previous = (await (await page.request.get('/api/releases')).json()).currentId;
  const nav = (name: RegExp) => page.locator('.sidebar').getByRole('button', { name });
  await nav(/Content/).click();
  await page.getByRole('button', { name: /New entry/ }).click();
  await page.getByLabel('URL slug', { exact: true }).fill('browser-authored-story');
  for (const [label, title] of [
    ['简体中文', '浏览器中新建的文章'],
    ['English', 'A browser authored story'],
    ['Français', 'Un article créé dans le navigateur'],
  ]) {
    await page.locator('.language-tabs').getByRole('button', { name: label, exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Summary', { exact: true }).fill(`${title} — summary`);
    await page
      .getByLabel('Body', { exact: true })
      .fill(`## ${title}\n\nDurable editorial workflow with a real image.`);
    await page.getByRole('button', { name: 'Mark this language reviewed', exact: true }).click();
    await expect(page.getByText('Reviewed', { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole('button', { name: 'Translate into this language', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('combobox', { name: 'Publication scope', exact: true })
    .selectOption('published');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await nav(/Media library/).click();
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#5eead4' } })
    .png()
    .toBuffer();
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith('/api/media') && r.request().method() === 'POST',
  );
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'editorial.png', mimeType: 'image/png', buffer: png });
  const upload = await (await responsePromise).json();
  const card = page
    .locator('.media-item')
    .filter({ has: page.getByRole('heading', { name: upload.media.filename, exact: true }) });
  await expect(card).toBeVisible();
  for (const label of ['简体中文', 'English', 'Français']) {
    await page.locator('.language-tabs').getByRole('button', { name: label, exact: true }).click();
    await card
      .getByRole('textbox', { name: new RegExp('Alternative text') })
      .fill(`Image description ${label}`);
    await card.getByLabel('Caption', { exact: true }).fill(`Caption ${label}`);
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await nav(/Content/).click();
  await page.getByRole('button', { name: /A browser authored story/ }).click();
  await page
    .getByRole('combobox', { name: 'Cover image', exact: true })
    .selectOption(upload.media.id);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await nav(/Preview & publish/).click();
  await expect(page.getByText('Checks passed', { exact: true })).toBeVisible();
  const createdResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/releases') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Create release preview/ }).click();
  const created = await (await createdResponse).json();
  const newReleaseRow = page.locator('.release-row').filter({ hasText: created.id });
  await expect(newReleaseRow.getByRole('link', { name: /Open preview/ })).toBeVisible({
    timeout: 60000,
  });
  const [preview] = await Promise.all([
    context.waitForEvent('page'),
    newReleaseRow.getByRole('link', { name: /Open preview/ }).click(),
  ]);
  await preview.waitForLoadState();
  await preview.goto('http://127.0.0.1:4522/fr/posts/browser-authored-story/');
  await expect(preview.locator('h1')).toContainText('Un article');
  await expect(preview.locator('.editorial-image img')).toHaveAttribute('src', upload.media.path);
  expect((await preview.request.get(`http://127.0.0.1:4522${upload.media.path}`)).status()).toBe(
    200,
  );
  await newReleaseRow.getByRole('button', { name: 'Publish this version', exact: true }).click();
  await expect(
    page.locator('.release-row').first().getByText('Current live version', { exact: true }),
  ).toBeVisible();
  const publicResponse = await page.request.get(
    'http://127.0.0.1:4523/en/posts/browser-authored-story/',
  );
  expect(publicResponse.status()).toBe(200);
  expect(await publicResponse.text()).toContain('A browser authored story');
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('.release-row')
    .filter({ hasText: previous })
    .getByRole('button', { name: 'Restore this version', exact: true })
    .click();
  await expect(
    page
      .locator('.release-row')
      .filter({ hasText: previous })
      .getByText('Current live version', { exact: true }),
  ).toBeVisible();
  expect(
    (await page.request.get('http://127.0.0.1:4523/en/posts/browser-authored-story/')).status(),
  ).toBe(404);
  await nav(/Content/).click();
  await page.getByRole('button', { name: /A browser authored story/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete entry', exact: true }).click();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await nav(/Media library/).click();
  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(card).not.toBeVisible();
});
