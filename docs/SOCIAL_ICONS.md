# Profile link icons

The editor and public website share `shared/social-icons.ts`: 50 bundled monochrome choices, including WeChat and Goodreads. No icon CDN or additional runtime dependency is needed. Brand paths inherit the site's text/accent colors.

The editor's `SocialIconPicker` displays the selected SVG, a native select, and a search field. Search accepts platform names, common aliases and Chinese names. Searching does not change the selected icon, and a previously saved unknown icon remains selectable. Unknown public icons retain the existing generic fallback. Existing icon keys remain compatible with stored drafts and releases; the existing limit of 30 profile links is unchanged.

## Available choices

- Communication and social: WeChat, QQ, Telegram, Discord, X/Twitter, Mastodon, Bluesky, Threads, Instagram, Facebook, Reddit, Weibo, RED/Xiaohongshu, LinkedIn, Email.
- Reading and publishing: Goodreads, Douban, Zhihu, Medium, Substack, DEV Community, Hashnode, Letterboxd, RSS.
- Development and research: GitHub, GitLab, Stack Overflow, Kaggle, Hugging Face, Google Scholar, ORCID, ResearchGate, arXiv, dblp, Zotero, Notion.
- Video, audio and games: Bilibili, YouTube, TikTok, Spotify, Apple Music, SoundCloud, Bandcamp, Last.fm, Steam, Twitch.
- Design and other links: Behance, Dribbble, Pinterest, Website/Link.

The icon is decorative; the profile link's user-supplied label supplies its accessible name. Selecting WeChat changes the icon, not the destination or URL scheme. Enter a valid web URL (for example, a public WeChat article or a page containing your QR code); this update does not introduce private QR uploads or an unsupported WeChat URL scheme.

## Sources and license

47 brand paths are vendored from [Simple Icons](https://github.com/simple-icons/simple-icons), npm package **16.35.0**, without modification to their SVG path geometry. Selected source files are `icons/<id>.svg` for every catalogue entry except `linkedin`, `email` and `link`.

- Source archive: `https://registry.npmjs.org/simple-icons/-/simple-icons-16.35.0.tgz`
- Archive SHA-256: `20ebead4f6bc93464812a5e260d19fc4d84772e5eeff69a6fbea263ca2441c5f`
- The upstream [CC0 license](licenses/simple-icons-LICENSE.md) and [disclaimer](licenses/simple-icons-DISCLAIMER.md) are included verbatim.
- LinkedIn and email retain the project's existing SVG paths. The generic link path is drawn for this project.

Simple Icons' CC0 dedication does not grant trademark rights or override individual brands' usage guidelines. The icons identify destinations and do not imply endorsement.

## Integration

Use `socialIcon(name)` to resolve a known icon or alias. `filterSocialIcons(query)` supplies the searchable list. Public utility icons (search, close, back, arrow) remain implemented by `apps/site/src/components/Icon.astro`.

`SocialIconPicker` props are `value`, `onChange`, `label`, `searchLabel` and optional `noResultsLabel`. Pass localized labels from the editor. It renders its own `.field` wrapper and label; do not wrap it in the admin `Field` component, which is itself a label.

Future additions should update this single catalogue and record their SVG source/license here. Never accept arbitrary uploaded SVG markup as an icon path.
