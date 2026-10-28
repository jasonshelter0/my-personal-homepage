# UCIT usage subsite

Routes: `/<locale>/projects/ucit-home/` (`zh-cn`, `en`, `fr`). Projects links to the guide; the shared Layout, reader, search, locale navigation and footer are reused. No website content snapshot or private draft is modified.

Source of truth: `docs/usage.json` in `jasonshelter0/obsidian-ucit-home`. From that plugin checkout run:

```sh
npm run docs:check
npm run docs:sync -- /path/to/personal-website
```

This replaces only `apps/site/src/content/ucit/usage.json` and `version.json`. Do not hand-edit them. Commit the generated copy and test `npm run typecheck`, `npm test`, `npm run build`, and `npx playwright test tests/browser/ucit.spec.ts tests/browser/learning-reader.spec.ts` before the established production release process.

The public, frozen `/projects/ucit-home/version.json` exposes the plugin version and guide SHA-256. After the reviewed website is deployed, the plugin's `npm run release:publish` checks both against its local source before creating the GitHub release. No runtime fetch, production credentials, scheduled updater or private vault content is embedded in the site. Future automation must preserve preview review and the real deployment lock.
