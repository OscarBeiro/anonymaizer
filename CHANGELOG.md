# Changelog

## 0.18.4 — 2026-10-12

- Add spacing between the dark-mode toggle and adjacent app header controls.

## 0.18.3 — 2026-10-12

- Remove the unpatched `vite-plugin-singlefile` → `micromatch` → `braces`
  dependency chain (GHSA-vfj7-8cjw-p6xm). Replace portable-build inlining with
  an exact bundle-reference helper that preserves separate opt-in NER workers.
- Add checks for literal script content, HTML closing-tag escaping and external
  references in portable HTML generation.
