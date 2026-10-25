import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterSocialIcons, SOCIAL_ICONS, socialIcon } from '../shared/social-icons.ts';
import { parseSnapshot } from '../server/schema.ts';
import { seed } from '../shared/seed.ts';

test('new social icon choices survive the existing snapshot validation and preserve legacy values', () => {
  for (const icon of SOCIAL_ICONS) {
    const snapshot = structuredClone(seed);
    snapshot.settings.socials[0].icon = icon.id;
    assert.equal(parseSnapshot(snapshot).settings.socials[0].icon, icon.id);
    assert.ok(icon.path.length > 10);
    assert.match(icon.path, /^[Mm]/);
  }
  const snapshot = structuredClone(seed);
  snapshot.settings.socials[0].icon = 'legacy-custom-profile';
  assert.equal(parseSnapshot(snapshot).settings.socials[0].icon, 'legacy-custom-profile');
  assert.equal(socialIcon('legacy-custom-profile'), undefined);
  assert.equal(new Set(SOCIAL_ICONS.map((icon) => icon.id)).size, SOCIAL_ICONS.length);
});

test('profile icon search supports Chinese names, common aliases and multiple terms', () => {
  assert.equal(filterSocialIcons('微信')[0]?.id, 'wechat');
  assert.equal(filterSocialIcons('GOODREAD')[0]?.id, 'goodreads');
  assert.equal(filterSocialIcons('谷歌学术')[0]?.id, 'googlescholar');
  assert.equal(filterSocialIcons('machine learning').length, 2);
  assert.equal(socialIcon('weixin')?.id, 'wechat');
  assert.equal(socialIcon('goodread')?.id, 'goodreads');
  assert.equal(socialIcon('twitter')?.id, 'x');
  assert.deepEqual(filterSocialIcons('not-a-platform'), []);
  assert.equal(filterSocialIcons('  ').length, SOCIAL_ICONS.length);
});
