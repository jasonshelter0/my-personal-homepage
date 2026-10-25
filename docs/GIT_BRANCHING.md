# Git branching learning page

The page lives at `https://www.jasonshelter.com/learn/git-branching/` with complete
`zh-cn`, `en`, and `fr` versions. The default alias follows the published site's
configured default locale. Public content is built from source alongside the
published snapshot; it never reads the private editor API.

## Source and integration

- `apps/site/src/components/GitLearningLesson.astro`: shared-layout lesson content,
  accessible expand/close controls and a same-origin isolated simulator frame.
- `apps/site/src/lib/git-learning.ts`: complete three-language page copy and
  upstream engine locale selection (`zh_CN`, `en_US`, `fr_FR`).
- `apps/site/src/lib/learning-catalog.ts`: course card/path registry, shared with
  the Mamba course. The existing learning routes generate aliases and localizations.
- `apps/site/public/learn-assets/git-branching/simulator.html`: reviewed standalone
  source asset. It includes all 36 levels, upstream locale bundles, scripts, CSS
  and fonts. It remains available through future Astro builds, without network
  dependencies for built-in practice. It is marked `noindex`; the parent pages
  provide indexed descriptions, canonical URLs, language alternates and search.
- `LICENSE.txt`: original Peter Cottle MIT notice.
- `server/index.ts`: only this exact static simulator file receives
  `X-Frame-Options: SAMEORIGIN`. All other resources retain `DENY`, including admin.
  Private preview authentication is unchanged. Both public and prefixed preview
  assets use the same narrow response policy.

The original upstream repository is <https://github.com/pcottle/learnGitBranching>,
pinned at `8b1fd893f2c0168edd5c7a5c38204e47e2897b67`. The local mobile fork is
`/home/jasonshelter/Projects/learnGitBranchingMobile/mobile-site`; the trilingual
fork commit is `df846d3`. `vendor/learn-git-branching/mobile.patch` records the full
source delta against that upstream commit, including the previous mobile/offline
and Android fixes, plus the English/French shell translations. No private hosting
credentials or external site data are required to rebuild it.

## Rebuild the simulator

In a new directory (do not reset an existing checkout):

```sh
git clone https://github.com/pcottle/learnGitBranching.git git-pocket-source
cd git-pocket-source
git checkout 8b1fd893f2c0168edd5c7a5c38204e47e2897b67
git apply /path/to/personal-website/vendor/learn-git-branching/mobile.patch
corepack yarn install --frozen-lockfile
corepack yarn test
corepack yarn vite build
node scripts/postbuild.js
node scripts/package-mobile.cjs
cd /path/to/personal-website
node scripts/update-git-simulator.mjs /path/to/git-pocket-source
```

Use Node 24 and the pinned Yarn 1.22.22 from the source package metadata. The
website itself keeps using its existing npm lockfile and normal Astro build.
Changing the simulator requires rerunning its browser checks and reviewing the
source patch and imported asset together. A routine website content publication
needs no simulator rebuild.

## Mobile behavior and checks

The simulator keeps upstream Git semantics and translated levels. The mobile
shell adds a real command textarea, touch command shortcuts, Enter/IME handling,
commit reorder buttons, visual viewport sizing, progress import/export and safe
storage fallback. In blocked-storage environments, a temporary-mode notice is
shown and practice remains usable. Android file previewers that disable JavaScript
cannot run interactive HTML; the public HTTPS page is the recommended entry.

Progress is local to a browser/origin. Export/import from Help transfers it between
origins or devices. Clearing site data removes saved progress. The standalone
file defaults to Chinese if no locale preference exists; Help includes links for
Chinese, English and French. External source and Gist links still require network.

Validation includes upstream 415 Git tests, website typecheck/build, packaging
checks, three-language mobile interaction/search/navigation, authenticated preview
embedding, blocked-storage offline operation, small/keyboard/landscape viewports,
and progress import/export. `tests/browser/git-learning.spec.ts` is part of the
regular browser suite. Live deployment IDs, backups and rollback instructions
are recorded in `RELEASE_HANDOFF.md` after the combined learning-page publication.

### Mobile objective width fix (2026-10-25)

The upstream goal-window selector had higher CSS specificity than the mobile
selector, leaving a 400px minimum width on narrow screens. The mobile rules now
win that cascade and constrain restored inline widths to the current viewport.
The graph measures the narrower container; it is not merely clipped. Objective
text also allows long words/commands to wrap. The regression test inspects panel
and SVG bounds, checks portrait/landscape and reopening at 320px, and verifies
that close/practice controls remain reachable in Chinese, English and French.

The mobile fork fix is commit `9b5d3485db21ac2e0a311f7153e7b9223779ed53`.
Validated all 36 English level goals/objectives at 320px, plus three-language
portrait/landscape/reopen regression tests; the existing 13 browser tests,
27 website tests and 415 upstream tests pass. The imported standalone file is
4,019,515 bytes, SHA-256
`8f7226b2da11ec8e5e75192e8a14aa78531dc166ff99dd50be2cc9c4ce753815`.
