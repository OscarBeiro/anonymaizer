// TICGAL rebrand: the product mark — TICGAL Azul circle, two-way arrows for
// the swap (data out, placeholders in, and back). Colours come from tokens
// via the .app-mark CSS; public/favicon.svg is the same drawing.
export const AppMarkIcon = () => (
  <svg className="app-mark-icon" viewBox="0 0 72 72" width="32" height="32" aria-hidden="true" focusable="false">
    <circle className="app-mark-disc" cx="36" cy="36" r="36" />
    <path className="app-mark-arrows" d="M20 30h26l-6-6M52 42H26l6 6" />
  </svg>
);
