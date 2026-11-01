# Changelog (dev)
<!-- changelog-format: 2 -->

Internal technical record. Public, end-user entries live in `/CHANGELOG.md`.

## [0.18.6] - 2026-11-01

### Bugs

- Dependabot/npm audit sweep, one commit per step (draft PR #16):
  - `dompurify` 3.4.16 -> 3.4.17: critical alert #28 plus GHSA-cg2g-xh64-v4q7, GHSA-mrv2-3pqr-j5jr, GHSA-c6gr-qvv4-5v3f.
  - `vite` ^8.3.0 -> ^8.3.5 (lock 8.3.5): alerts #20-25 (dev-server only); supersedes Dependabot PR #9.
  - `vitest` ^5.0.1 -> ^5.0.3 (lock 5.0.5): pulls `@vitest/mocker` 5.0.5, alerts #26-27 (dev-only).
  - `postal-mime` ^3.0.0 -> ^4.2.0: quadratic CPU on RFC 2047 headers (DoS, GHSA-f2hq-32vh-53cc). 4.x breaking changes: whitespace kept when unfolding headers, first-wins for duplicated single-value headers, `to`/`cc`/`bcc`/`replyTo` in document order. None broke the `.eml` tests, but 4.x now returns header-less plain text as `text` instead of an empty shell, so `src/lib/parsers/eml.ts` additionally rejects input with zero parsed headers (test "throws an error naming the file when the bytes are not a message").
  - `npm audit fix` for the remaining dev-only transitive advisories: `happy-dom` 21.0.4, `undici` 8.12.3 (via jsdom).
- Move to Node 24: `.nvmrc` 24.22.2, `engines.node` >=24.0.0, CI `NODE_VERSION` 24, and the Podman dev image (`~/containers/anonymaizer`) to `node:24-alpine`. `npm ci`, test, lint, both builds and `npm audit` pass on 24.22.2.
- `package.json` `allowScripts` explicitly denies the install scripts of `protobufjs` (cosmetic version-scheme warning) and `onnxruntime-node` (binary download, would break hard rule 3); silences npm 11's unapproved-script warning. `npm ci` is now warning-free and tests pass.
- postal-mime 4.2.0 source checked: no fetch/XHR/network code (hard rule 3).
- Checks per step: `npm test`, `npm run lint`, `npm run build`; `build:portable` after dompurify and postal-mime. `npm audit`: 0 vulnerabilities.
