# Translation services

Folio Studio offers a service selector in the profile and content review panels. Choose the target language tab, select a service, and click **Translate into this language**. Confirm the replacement, inspect the translated text, mark it reviewed, then create a preview and publish when ready. Saving or translating a draft does not publish it.

## MyMemory: available without a key

The default installation can use MyMemory's official translation API without account setup. The selected source-language text is sent to MyMemory only when the owner confirms a translation action. The editor displays this disclosure before sending it.

- Anonymous usage has a documented allowance of **5,000 characters per day**. The allowance is shared across requests; it is not 5,000 characters for each click or language. Provider availability and limits can change.
- Folio limits each MyMemory action to **4,500 source prose characters** and splits requests at the API's **500 UTF-8 byte** boundary. This does not reserve or guarantee remaining daily quota.
- Markdown prose is translated while code, link destinations and formatting are preserved. Structures that cannot be reconstructed safely are rejected rather than silently damaged.
- Translation has a time limit and a request-count limit. Quota errors, failures, invalid replies and concurrent edits do not partially replace the target translation.
- New translations are **unreviewed**. There is no automatic publication and no silent fallback to another provider.

An anonymous synthetic sentence was successfully translated from the Alibaba server during implementation. This is a connectivity check, not a guarantee that a free external service will always be available.

Official references: [API specification](https://mymemory.translated.net/doc/spec.php), [usage limits](https://mymemory.translated.net/doc/usagelimits.php).

## LibreTranslate: optional configured server

Set `LIBRETRANSLATE_URL` to a trusted LibreTranslate instance's base URL. Set `LIBRETRANSLATE_API_KEY` only if that instance requires one. These are server-side settings; neither value is editable through public requests or disclosed by the provider-status API.

Self-hosted LibreTranslate is free software and does not impose a per-translation fee, but hosting requires resources. The commercial `libretranslate.com` endpoint requires a paid API key; it is not configured as a free default. Public instances have their own languages, availability and quotas. This update does not install an additional translation model on the small production server.

Reference: [LibreTranslate API usage](https://docs.libretranslate.com/guides/api_usage/).

## Existing OpenAI-compatible service

The existing `TRANSLATION_BASE_URL`, `TRANSLATION_API_KEY` and `TRANSLATION_MODEL` configuration remains supported. `TRANSLATION_GLOSSARY` is optional. This option is enabled only when the required server settings exist; pricing and limits depend on the selected provider.

Default selection prefers an already configured OpenAI-compatible service, then a configured LibreTranslate server, otherwise MyMemory. The owner can explicitly select MyMemory even when another service is configured. Unconfigured options are visible but disabled.

## Operations

Production settings live in the existing restricted server configuration, documented in `RELEASE_HANDOFF.md`. Change optional provider configuration there and recreate the existing Compose service to load it. Do not place credentials in source control or browser code.

The API accepts an optional `provider` field with `mymemory`, `libretranslate` or `openai`. Omitting it selects the configured default. Authentication, reviewed-content overwrite checks, source hashes and draft revision checks still apply. The status endpoint reports configuration availability, not a successful provider health probe or remaining quota.

## Image descriptions and homepage sections (1.3.0)

The media library translates alternative text and captions without uploading image files to a provider. Homepage sections translate localized titles and optional Markdown bodies. Choose the source language and target editor language, confirm sending/overwriting, then proofread. Empty optional fields remain empty. Existing provider limits, link/code preservation, atomic saves and concurrent-edit checks apply. See [section and release management](SECTIONS_AND_RELEASES.md).
