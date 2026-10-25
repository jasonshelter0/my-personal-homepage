import { test, expect, type Page } from '@playwright/test';
import type { Snapshot } from '../../shared/types';

async function login(page: Page) {
  await page.goto('/admin/');
  await page.getByLabel('密码', { exact: true }).fill('local-demo-password');
  await page.getByRole('button', { name: '登录工作室' }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来。' })).toBeVisible();
  await page.getByRole('combobox', { name: '界面语言', exact: true }).selectOption('en');
}

async function openSection(page: Page, name: RegExp) {
  await page.locator('.sidebar').getByRole('button', { name }).click();
}

async function expectFitsPhone(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy();
}

test('free translation is selectable, disclosed and reviewed without publishing or external requests', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  const original = (await (await page.request.get('/api/snapshot')).json()) as Snapshot;
  let translationCalls = 0;
  let translatedRequest: Record<string, unknown> | undefined;
  const translated = structuredClone(original);
  translated.settings.profile.en.headline = 'A translated profile requiring review';
  translated.settings.profile.en.reviewed = false;
  // Intercept every editor translation call. This test never sends source text
  // to a real translation provider and never writes the mocked result to SQLite.
  await page.route('**/api/translate', async (route) => {
    translationCalls++;
    translatedRequest = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: translated });
  });

  await openSection(page, /Profile/);
  const provider = page.getByRole('combobox', { name: 'Translation service', exact: true });
  await expect(provider).toHaveValue('mymemory');
  await expect(provider.locator('option[value="mymemory"]')).toHaveJSProperty('disabled', false);
  await expect(provider.locator('option[value="libretranslate"]')).toHaveJSProperty(
    'disabled',
    true,
  );
  await expect(provider.locator('option[value="openai"]')).toHaveJSProperty('disabled', true);
  await expect(page.getByText(/MyMemory is free with no API key/)).toBeVisible();
  const translate = page.getByRole('button', { name: 'Translate into this language', exact: true });
  await expect(translate).toBeDisabled();
  await page
    .locator('.language-tabs')
    .getByRole('button', { name: 'English', exact: true })
    .click();
  await expect(translate).toBeEnabled();
  await expectFitsPhone(page);

  let confirmation = '';
  page.once('dialog', async (dialog) => {
    confirmation = dialog.message();
    await dialog.dismiss();
  });
  await translate.click();
  expect(confirmation).toContain('MyMemory');
  expect(confirmation).toContain('sent to this translation service');
  expect(translationCalls).toBe(0);
  await expect(page.getByLabel('Role / headline', { exact: true })).toHaveValue(
    original.settings.profile.en.headline,
  );

  page.once('dialog', (dialog) => dialog.accept());
  await translate.click();
  await expect(page.getByLabel('Role / headline', { exact: true })).toHaveValue(
    translated.settings.profile.en.headline,
  );
  expect(translationCalls).toBe(1);
  expect(translatedRequest).toMatchObject({
    provider: 'mymemory',
    profile: true,
    targetLocale: 'en',
    overwrite: true,
  });
  await expect(page.locator('.review-panel .pill')).toHaveText('Needs review');
  expect(await (await page.request.get('/api/snapshot')).json()).toEqual(original);
  await expectFitsPhone(page);
  await page.locator('.sidebar-bottom select').selectOption('fr');
  await expect(
    page.getByRole('combobox', { name: 'Service de traduction', exact: true }),
  ).toHaveValue('mymemory');
  await expect(page.getByText(/MyMemory est gratuit sans clé/)).toBeVisible();
  await page.locator('.sidebar-bottom select').selectOption('zh-CN');
  await expect(page.getByRole('combobox', { name: '翻译服务', exact: true })).toHaveValue(
    'mymemory',
  );
  await expect(page.getByText(/MyMemory 免费免密钥/)).toBeVisible();
});

test('WeChat and Goodreads icons can be searched, previewed, saved and reloaded on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  const original = (await (await page.request.get('/api/snapshot')).json()) as Snapshot;
  expect(original.settings.socials.length).toBeGreaterThanOrEqual(2);
  try {
    await openSection(page, /Appearance/);
    const first = page.locator('.social-icon-picker').nth(0);
    const second = page.locator('.social-icon-picker').nth(1);
    expect(await first.locator('option').count()).toBeGreaterThan(30);
    await first.getByRole('searchbox', { name: 'Search icons or platform names' }).fill('微信');
    await first.getByRole('combobox', { name: 'Icon', exact: true }).selectOption('wechat');
    await expect(first.locator('svg[data-social-icon="wechat"]')).toBeVisible();
    await expect(first.getByRole('searchbox')).toHaveValue('');
    await second
      .getByRole('searchbox', { name: 'Search icons or platform names' })
      .fill('goodreads');
    await second.getByRole('combobox', { name: 'Icon', exact: true }).selectOption('goodreads');
    await expect(second.locator('svg[data-social-icon="goodreads"]')).toBeVisible();
    await expectFitsPhone(page);

    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled();
    await page.reload();
    await openSection(page, /Appearance/);
    await expect(first.getByRole('combobox', { name: 'Icon', exact: true })).toHaveValue('wechat');
    await expect(second.getByRole('combobox', { name: 'Icon', exact: true })).toHaveValue(
      'goodreads',
    );
    const saved = (await (await page.request.get('/api/snapshot')).json()) as Snapshot;
    expect(saved.settings.socials[0].icon).toBe('wechat');
    expect(saved.settings.socials[1].icon).toBe('goodreads');
    await expectFitsPhone(page);
  } finally {
    // Preserve the rest of the shared E2E fixture, including reviewed content.
    const current = (await (await page.request.get('/api/snapshot')).json()) as Snapshot;
    const restored = await page.request.put('/api/snapshot', {
      data: { ...original, revision: current.revision },
    });
    expect(restored.ok()).toBeTruthy();
  }
});
