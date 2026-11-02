# Changelog (dev)
<!-- changelog-format: 2 -->

Internal technical record. Public, end-user entries live in `/CHANGELOG.md`.

## [0.19.0-dev] - unreleased

### Features

- TICGAL rebrand (design: Claude Design canvas, direction A "Veil" with the C "Swap" icon):
  - Logo: TICGAL Azul `#658bc5` disc with white two-way arrows. `src/components/AppMark.tsx` replaces the "A" tile in the app header, site header and legal pages; `public/favicon.svg` (was Vite's placeholder) is the same drawing. New token `--color-on-brand`.
  - Colours (`src/styles/tokens.css`): text is TICGAL Azul intenso `#2a5698` and darker shades (`--color-text` `#1f3f70`, `--color-text-muted` `#3f5f92`), accent `#2a5698`, borders Azul T `#a9c6e9`, new `--color-brand-light` (Azul C `#9bc9ed`). Dark theme accent is Azul C. `tokens.test.ts` AA checks pass unchanged.
  - Type: bundled webfonts in `src/styles/fonts.css` from `@fontsource-variable/urbanist`, `@fontsource-variable/inter`, `@fontsource/ibm-plex-mono` (5.3.0; CSS and woff2 only, no install scripts or runtime code, so hard rule 3 holds). Urbanist (stand-in for Nexa) for h1–h3 and the wordmark via new `--font-display`; Inter for text (latin + latin-ext); IBM Plex Mono for placeholders (latin). Hosted build serves them same-origin (CSP `font-src 'self'` unchanged); portable build inlines all five as `data:` URIs (+~190 kB raw).
  - `public/og-image.png` re-rendered in the new palette.
- Checks: `npm test`, `npm run lint`, `npm run build`, `npm run build:portable` (no external font URL left); landing and `/app` screenshotted from `vite preview`.

## [0.18.6] - 2026-11-01

### Bugs

- Dependabot/npm audit sweep, one commit per step (draft PR #16):
  - `dompurify` 3.4.16 -> 3.4.17: critical alert #28 plus GHSA-cg2g-xh64-v4q7, GHSA-mrv2-3pqr-j5jr, GHSA-c6gr-qvv4-5v3f.
  - `vite` ^8.3.0 -> ^8.3.5 (lock 8.3.5): alerts #20-25 (dev-server only); supersedes Dependabot PR #9.
  - `vitest` ^5.0.1 -> ^5.0.3 (lock 5.0.5): pulls `@vitest/mocker` 5.0.5, alerts #26-27 (dev-only).
  - `postal-mime` ^3.0.0 -> ^4.2.0: quadratic CPU on RFC 2047 headers (DoS, GHSA-f2hq-32vh-53cc). 4.x breaking changes: whitespace kept when unfolding headers, first-wins for duplicated single-value headers, `to`/`cc`/`bcc`/`replyTo` in document order. None broke the `.eml` tests, but 4.x now returns header-less plain text as `text` instead of an empty shell, so `src/lib/parsers/eml.ts` additionally rejects input with zero parsed headers (test "throws an error naming the file when the bytes are not a message").
  - `npm audit fix` for the remaining dev-only transitive advisories: `happy-dom` 21.0.4, `undici` 8.12.3 (via jsdom).
- Node 24 move landed separately on main (PR #15); this branch only adds the Podman dev image bump to `node:24-alpine` (`~/containers/anonymaizer`) and verification on Node 24.
- `package.json` `allowScripts` explicitly denies the install scripts of `protobufjs` (cosmetic version-scheme warning) and `onnxruntime-node` (binary download, would break hard rule 3); silences npm 11's unapproved-script warning. `npm ci` is now warning-free and tests pass.
- postal-mime 4.2.0 source checked: no fetch/XHR/network code (hard rule 3).
- Checks per step: `npm test`, `npm run lint`, `npm run build`; `build:portable` after dompurify and postal-mime. `npm audit`: 0 vulnerabilities.
