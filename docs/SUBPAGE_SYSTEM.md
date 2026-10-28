# Folio subpage system

This document is the implementation contract for humans and AI agents adding a public page below
the personal homepage. Read it before editing routes, layouts, shared styles, navigation, or search.
The goal is family resemblance rather than cloned pages: consistent shell and behavior, with room
for each subject to choose its own diagrams and editorial rhythm.

## 1. Choose the page family

| Family                    | Examples                                  | Required shell                                                                                                      |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Index                     | `/projects`, `/posts`, `/pages`, `/learn` | `Layout.astro`; concise heading, cards/list, no custom app chrome                                                   |
| Editorial detail          | an article, project, information page     | `Layout.astro`; readable measure, optional cover, semantic article structure                                        |
| Learning / long-form tool | `/learn/<course>` and chapters            | `Layout.astro` + shared `LearningReader.astro`; immersive and native-fullscreen controls                            |
| Focused interactive tool  | a simulator within a lesson               | Keep the page shell; place the tool in a bounded themed panel, then offer immersive mode through the learning shell |

Do not build a standalone header, language switcher, search dialog, profile sidebar, cursor glow,
footer, or theme system. Extend shared primitives if a capability is genuinely reusable.

## 2. Visual language

- Use the published CSS variables for background and accent. The default expression is deep navy,
  mint-teal highlights, slate secondary text, fine borders, low-contrast layers, and generous space.
- Type hierarchy should come from the shared styles. Body text remains comfortable at wide desktop
  sizes; interactive visualizations may use the extra width, but prose must not stretch edge to edge.
- Prefer one clear visual idea over dense decoration. Images may use the editorial prompt in
  `docs/PASSAGE_IMAGE_PROMPT.md`.
- Motion is quiet and purposeful. Respect `prefers-reduced-motion`; keyboard focus must remain
  visible. Cursor glow is inherited from the shared layout and is not reimplemented per page.
- Use existing border radii, line colors, button styles, and spacing. A page-specific accent motif is
  acceptable inside its content panel, not as a replacement for the global shell.

## 3. Personal profile and immersive reading

The profile panel is the common desktop anchor. Normal index and short editorial pages keep it
visible. Learning and long-form pages must enable the shared reader:

1. Pass a `learn` path through `Layout.astro`; it mounts `LearningReader.astro`.
2. The **Immersive reading** action slides/hides the left personal panel and expands the content.
3. Preserve the sticky reader toolbar with learning-hub return, language switcher, search, mode exit,
   and optional browser fullscreen.
4. Store only the reader preference in the established local key. The page must still work when
   storage or fullscreen is unavailable.
5. `Escape` must first respect open dialogs or expanded embedded tools before exiting a broader
   reading state. Do not trap focus or remove the global skip link.
6. On mobile the profile is already compact; reader controls must fit at 320 px without horizontal
   overflow. On large monitors the prose column stays readable while diagrams can expand.

If a future non-learning page genuinely needs the same behavior, generalize the shared reader
component and storage key in one backward-compatible change. Do not copy its script or CSS.

## 4. Routing, links, and assets

- Create locale-complete routes using the repository's Astro route pattern and `Locale` type.
- Generate internal links with `href(locale, path)`, public/canonical URLs with `publicHref`, and
  prefixed assets with `withBase`. Resolve managed media through `media(id)`.
- Private previews run below `/preview/<release-id>/`; every route, language switch, search result,
  image, script, stylesheet, and downloadable asset must work under that prefix.
- Avoid reserved namespaces: `/admin`, `/api`, `/preview`, `/healthz`, `/media`, `/pagefind`, and
  `/_astro`.
- Add meaningful page title, description, canonical and alternate-language metadata through the
  shared layout. Use one logical `h1` and semantic landmarks.

## 5. Three-language content

- `zh-CN`, `en`, and `fr` are complete products, not fallback labels. Navigation, controls, error
  states, diagram labels, captions, alt text, metadata, and downloadable instructions need all three.
- Language switching must keep the visitor on the equivalent page or chapter.
- Do not ship machine translation without review. Technical tokens may remain in English when that
  is the established notation, but the surrounding explanation must be localized.
- Never hide missing text with another locale; fail validation or omit the unpublished page instead.

## 6. Search and navigation

- Public prose that should be discoverable stays inside `data-pagefind-body`; chrome and tool-only
  controls use `data-pagefind-ignore`.
- Assign a useful Pagefind `type` category through `Layout.astro` and verify a distinctive query in
  every locale.
- The shared search trigger supports `Ctrl` or `Command` + `K`; do not register a competing shortcut.
- Every deep page needs an obvious route back to its parent index. In immersive mode that route must
  remain visible in the reader toolbar.

## 7. Data and publication boundaries

- Code-only routes are rebuilt from the latest **published** snapshot. Never seed over, rewrite, or
  publish the owner's private draft.
- Media references use stable IDs and `/media/<filename>` paths. Classification metadata may change;
  file identities and historical frozen release assets do not.
- New persistent fields must be optional or receive a parser default so existing snapshots remain
  valid. Document any real migration and provide rollback before deployment.
- Preview first, inspect through authenticated real HTTPS, then publish the same immutable release.

## 8. Definition of done

At minimum, before handoff:

1. Run `npm run typecheck`, `npm test`, and `npm run build`.
2. Add focused browser coverage for the new route and shared behavior.
3. Verify normal and private-preview paths, all three locales, language continuity, search, keyboard
   operation, reduced motion, 320 px mobile, and a wide desktop viewport.
4. Check for horizontal overflow, browser exceptions, failed resources, duplicate headings, missing
   alt text, and inaccessible control names.
5. If deploying, follow `RELEASE_HANDOFF.md` and the server coordination documents: one writer,
   deployment lock, stopped-app backup, immutable image, published-snapshot rebuild, authenticated
   preview, public verification, rollback record, and no unrelated infrastructure changes.

When handing work to another AI, point it to this file and state the intended page family. The agent
should explain any deliberate exception in its handoff rather than silently creating a new pattern.
