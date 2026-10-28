# Repository instructions for AI contributors

Before creating or changing any public subpage, read and follow
[`docs/SUBPAGE_SYSTEM.md`](docs/SUBPAGE_SYSTEM.md). It is the canonical visual,
interaction, localization, routing, search, preview, testing, and deployment contract.

- Reuse the shared Astro layout and existing components; do not create a second shell.
- Preserve all three complete locales (`zh-CN`, `en`, `fr`) and preview-prefix-safe links.
- Learning/long-form pages must use the shared immersive reader so the left profile can slide
  away without losing language, search, or exit controls.
- Never hard-code production origins or `/en/`, `/media/`, `/_astro/`, `/pagefind/` paths.
- Do not modify or publish private drafts when integrating code-only subpages.
- Run the checks required by the contract before handoff or deployment.

Existing user files, media IDs/paths, persisted content, release history, and unrelated working-tree
changes must be preserved.
