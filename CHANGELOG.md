# Changelog
<!-- changelog-format: 2 -->

## 0.18.6 — 2026-11-01

### Bugs

- Update bundled libraries to fix known security vulnerabilities.
- Reject `.eml` files that contain no email headers instead of importing them as plain text.

## 0.18.5 — 2026-10-13

### Features

- Use model location predictions and add default offline detection for common cities, regions and countries.
- Detect Spanish postal address fragments and EU VAT/company tax identifiers.

### Bugs

- Refresh sanitised output after local model loading, document edits and file imports.

## 0.18.4 — 2026-10-12

### Bugs

- Add spacing between the dark-mode toggle and adjacent app header controls.

## 0.18.3 — 2026-10-12

### Bugs

- Remove a vulnerable build dependency from the portable build.
