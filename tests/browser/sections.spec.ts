import { test, expect, type Page } from '@playwright/test';

async function build(page: Page) {
  const response = await page.request.post('/api/releases', { data: {} });
  expect(response.status()).toBe(202);
  const release = await response.json();
  await expect
    .poll(
      async () => {
        const { releases } = await (await page.request.get('/api/releases')).json();
        return releases.find((item: { id: string }) => item.id === release.id)?.status;
      },
      { timeout: 90000 },
    )
    .toBe('ready');
  return release;
}

test('manage localized homepage sections, freeze previews and omit section numbers', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(180000);
  await page.addInitScript(() => localStorage.setItem('studio-language', 'en'));
  await page.request.post('/api/login', { data: { password: 'local-demo-password' } });
  const original = await (await page.request.get('/api/snapshot')).json();
  const baseline = await build(page);
  await page.goto(baseline.previewUrl);
  expect(
    (await page.request.post(`/api/releases/${baseline.id}/publish`, { data: {} })).ok(),
  ).toBeTruthy();
  const live = await context.newPage();
  const save = async () => {
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  };
  const appearance = async () => {
    await page.goto('/admin/');
    await page
      .locator('.sidebar')
      .getByRole('button', { name: /Appearance/ })
      .click();
  };
  try {
    await appearance();
    await expect(page.locator('.sidebar .nav-number')).toHaveCount(0);
    await page.getByRole('button', { name: /New section/ }).click();
    const editor = page.locator('.section-editor').last();
    const id = (await editor.getAttribute('data-section-id'))!;
    const section = page.locator(`[data-section-id="${id}"]`);
    const titles = {
      'zh-CN': '兴趣与实践',
      en: 'Interests and practice',
      fr: 'Intérêts et pratique',
    };
    for (const locale of ['zh-CN', 'en', 'fr'] as const) {
      await section
        .getByRole('combobox', { name: 'Section language', exact: true })
        .selectOption(locale);
      await section
        .getByRole('textbox', { name: 'Section title', exact: true })
        .fill(titles[locale]);
      await section
        .getByRole('textbox', { name: 'Section body (Markdown)', exact: true })
        .fill(`${titles[locale]} — uniquely-curated-section\n\n![Atlas](/media/atlas.svg)`);
    }
    await section
      .getByRole('combobox', { name: 'Section language', exact: true })
      .selectOption('en');
    await section
      .getByRole('group', { name: 'Section cards', exact: true })
      .getByRole('checkbox', { name: /Atlas/ })
      .check();
    for (let i = 0; i < original.settings.sections.length; i++)
      await section
        .getByRole('button', { name: 'Move up Interests and practice', exact: true })
        .click();
    await save();
    await page.reload();
    await page
      .locator('.sidebar')
      .getByRole('button', { name: /Appearance/ })
      .click();
    expect(await page.locator('.section-editor').first().getAttribute('data-section-id')).toBe(id);
    // A selected draft must never turn into a public card.
    const snapshot = await (await page.request.get('/api/snapshot')).json();
    const draft = structuredClone(snapshot.entries[0]);
    Object.assign(draft, {
      id: 'section-private-draft',
      slug: 'section-private-draft',
      status: 'draft',
    });
    draft.translations.en.title = 'PRIVATE-SECTION-CARD';
    snapshot.entries.push(draft);
    snapshot.settings.sections[0].entryIds.push(draft.id);
    snapshot.settings.sections.push({
      id: 'section-hidden-test',
      enabled: false,
      titles: { 'zh-CN': '', en: '', fr: '' },
      body: { 'zh-CN': '', en: 'PRIVATE-HIDDEN-SECTION', fr: '' },
    });
    expect((await page.request.put('/api/snapshot', { data: snapshot })).ok()).toBeTruthy();
    const selected = await build(page);
    await live.goto('http://127.0.0.1:4523/en/');
    await expect(live.locator(`#${id}`)).toHaveCount(0);
    await page.goto(selected.previewUrl);
    const previewRoot = new URL(selected.previewUrl).origin;
    for (const [route, locale] of [
      ['zh-cn', 'zh-CN'],
      ['en', 'en'],
      ['fr', 'fr'],
    ] as const) {
      await page.goto(`${previewRoot}/${route}/`);
      await expect(page.locator('.home-section').first()).toHaveAttribute('id', id);
      await expect(page.locator('.section-index, .nav-number')).toHaveCount(0);
      await expect(page.locator(`a[data-nav="${id}"]`)).toHaveText(titles[locale]);
      await expect(page.locator(`#${id} h2`)).toHaveText(titles[locale]);
      await expect(page.locator(`#${id} .content-card`)).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText('PRIVATE-SECTION-CARD');
      await expect(page.locator('body')).not.toContainText('PRIVATE-HIDDEN-SECTION');
      await expect
        .poll(() =>
          page
            .locator(`#${id} .prose img`)
            .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        )
        .toBeTruthy();
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
      }
    }
    await page.screenshot({ path: testInfo.outputPath('sections-desktop.png'), fullPage: true });
    for (const route of ['zh-cn', 'en', 'fr']) {
      await page.goto(`${previewRoot}/${route}/`);
      await expect(page.locator('.site-footer')).not.toContainText(
        /FOLIO|用心设计|Thoughtfully made|Conçu avec soin/i,
      );
      await expect(page.locator('a[href="https://brittanychiang.com/"]')).toHaveCount(0);
      await page.locator('.site-notes-link').click();
      await expect(page).toHaveURL(new RegExp(`/${route}/site-notes/$`));
      await expect(page.locator('a[href="https://brittanychiang.com/"]')).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/\bFOLIO\b/i);
    }

    expect(
      (await page.request.post(`/api/releases/${selected.id}/publish`, { data: {} })).ok(),
    ).toBeTruthy();
    await live.goto('http://127.0.0.1:4523/en/');
    await expect(live.locator(`#${id}`)).toBeVisible();
    await live.getByRole('button', { name: 'Search', exact: true }).click();
    await live.getByRole('searchbox').fill('uniquely-curated-section');
    await expect(live.locator('#search-results a').first()).toBeVisible();
    await live.keyboard.press('Escape');

    await appearance();
    await section.getByRole('checkbox', { name: 'Visible', exact: true }).uncheck();
    await save();
    const hidden = await build(page);
    await page.goto(hidden.previewUrl);
    await expect(page.locator(`#${id}, a[data-nav="${id}"]`)).toHaveCount(0);
    await live.reload();
    await expect(live.locator(`#${id}`)).toBeVisible();
    await appearance();
    page.on('dialog', (dialog) => dialog.accept());
    await section
      .getByRole('button', { name: 'Delete section Interests and practice', exact: true })
      .click();
    await page
      .locator('[data-section-id="about"]')
      .getByRole('button', { name: 'Delete section About', exact: true })
      .click();
    await page
      .getByRole('combobox', { name: 'Restore built-in section', exact: true })
      .selectOption('about');
    await page.getByRole('button', { name: 'Add back to homepage', exact: true }).click();
    await save();
    const final = await (await page.request.get('/api/snapshot')).json();
    expect(final.settings.sections.some((item: { id: string }) => item.id === id)).toBeFalsy();
    expect(
      final.settings.sections.some((item: { id: string }) => item.id === 'about'),
    ).toBeTruthy();
    expect(final.entries.length).toBe(original.entries.length + 1);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
    await page.screenshot({
      path: testInfo.outputPath('sections-admin-mobile.png'),
      fullPage: true,
    });
  } finally {
    const current = await (await page.request.get('/api/snapshot')).json();
    original.revision = current.revision;
    expect((await page.request.put('/api/snapshot', { data: original })).ok()).toBeTruthy();
    await live.close();
  }
});

test('delete obsolete release records while protecting the live version', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => localStorage.setItem('studio-language', 'en'));
  await page.request.post('/api/login', { data: { password: 'local-demo-password' } });
  const live = await build(page);
  await page.goto(live.previewUrl);
  expect(
    (await page.request.post(`/api/releases/${live.id}/publish`, { data: {} })).ok(),
  ).toBeTruthy();
  const obsolete = await build(page);
  await page.goto('/admin/');
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Preview & publish/ })
    .click();
  const row = page.locator('.release-row').filter({ hasText: obsolete.id });
  const current = page.locator('.release-row').filter({ hasText: live.id });
  await expect(
    current.getByRole('button', { name: 'Delete release record', exact: true }),
  ).toBeDisabled();
  expect((await page.request.delete(`/api/releases/${live.id}`)).status()).toBe(409);
  page.once('dialog', (dialog) => dialog.dismiss());
  await row.getByRole('button', { name: 'Delete release record', exact: true }).click();
  await expect(row).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Delete release record', exact: true }).click();
  await expect(row).toHaveCount(0);
  expect((await page.request.get(obsolete.previewUrl)).status()).toBe(404);
  const outsider = await context.browser()!.newContext();
  expect(
    (await outsider.request.delete(`http://127.0.0.1:4521/api/releases/${live.id}`)).status(),
  ).toBe(401);
  await outsider.close();
  expect((await page.request.get('http://127.0.0.1:4523/en/')).status()).toBe(200);
  expect((await (await page.request.get('/api/releases')).json()).currentId).toBe(live.id);
});

test('media and section translation disclose sending and preserve editable language choices', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('studio-language', 'en'));
  await page.request.post('/api/login', { data: { password: 'local-demo-password' } });
  const original = await (await page.request.get('/api/snapshot')).json();
  let calls = 0;
  let sent: Record<string, unknown> = {};
  // UI test uses a mock response; provider behavior is tested independently.
  await page.route('**/api/translate', async (route) => {
    calls++;
    sent = route.request().postDataJSON();
    const result = await (await page.request.get('/api/snapshot')).json();
    if (sent.mediaId) {
      const media = result.media.find((item: { id: string }) => item.id === sent.mediaId);
      media.alt.en = 'Translated image alternative';
      media.caption.en = 'Translated image caption';
    } else {
      const section = result.settings.sections.find(
        (item: { id: string }) => item.id === sent.sectionId,
      );
      section.titles.en = 'Translated interests';
      section.body.en = 'Translated section body';
    }
    await route.fulfill({ status: 200, json: result });
  });
  try {
    await page.goto('/admin/');
    await page.locator('.sidebar').getByRole('button', { name: /Media/ }).click();
    const media = page.locator('.media-item').first();
    await expect(
      media.getByRole('button', { name: 'Translate image descriptions into this language' }),
    ).toBeDisabled();
    await page
      .locator('.language-tabs')
      .getByRole('button', { name: 'English', exact: true })
      .click();
    await page
      .getByRole('combobox', { name: 'Translation source language', exact: true })
      .selectOption('zh-CN');
    await page
      .getByRole('combobox', { name: 'Translation service', exact: true })
      .selectOption('mymemory');
    let confirmation = '';
    page.once('dialog', async (dialog) => {
      confirmation = dialog.message();
      await dialog.dismiss();
    });
    await media
      .getByRole('button', { name: 'Translate image descriptions into this language' })
      .click();
    expect(confirmation).toContain('MyMemory');
    expect(calls).toBe(0);
    page.once('dialog', (dialog) => dialog.accept());
    await media
      .getByRole('button', { name: 'Translate image descriptions into this language' })
      .click();
    await expect(
      media.getByRole('textbox', { name: 'Alternative text · English', exact: true }),
    ).toHaveValue('Translated image alternative');
    await expect(media.getByRole('textbox', { name: 'Caption', exact: true })).toHaveValue(
      'Translated image caption',
    );
    expect(sent).toMatchObject({
      mediaId: original.media[0].id,
      sourceLocale: 'zh-CN',
      targetLocale: 'en',
      provider: 'mymemory',
      overwrite: true,
    });

    await page
      .locator('.sidebar')
      .getByRole('button', { name: /Appearance/ })
      .click();
    await page.getByRole('button', { name: /New section/ }).click();
    const section = page.locator('.section-editor').last();
    const id = await section.getAttribute('data-section-id');
    await section
      .getByRole('combobox', { name: 'Section language', exact: true })
      .selectOption('zh-CN');
    await section.getByRole('textbox', { name: 'Section title', exact: true }).fill('兴趣');
    await section
      .getByRole('textbox', { name: 'Section body (Markdown)', exact: true })
      .fill('阅读与摄影');
    await section
      .getByRole('combobox', { name: 'Section language', exact: true })
      .selectOption('en');
    page.once('dialog', (dialog) => dialog.accept());
    await section
      .getByRole('button', { name: 'Translate section into this language', exact: true })
      .click();
    await expect(section.getByRole('textbox', { name: 'Section title', exact: true })).toHaveValue(
      'Translated interests',
    );
    await expect(
      section.getByRole('textbox', { name: 'Section body (Markdown)', exact: true }),
    ).toHaveValue('Translated section body');
    expect(sent).toMatchObject({
      sectionId: id,
      sourceLocale: 'zh-CN',
      targetLocale: 'en',
      provider: 'mymemory',
      overwrite: true,
    });
    expect(calls).toBe(2);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
  } finally {
    const current = await (await page.request.get('/api/snapshot')).json();
    original.revision = current.revision;
    expect((await page.request.put('/api/snapshot', { data: original })).ok()).toBeTruthy();
  }
});
