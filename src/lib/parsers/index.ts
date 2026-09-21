// The single registration site for concrete document parsers. App.tsx
// imports this file once (`import './lib/parsers'`); adding a format is one
// line here and nothing else.
//
// **No library imports in this file, ever** — only loader thunks. A static
// `import mammoth from 'mammoth'` here would pull every parser's library into
// the main bundle for users who only ever paste text, which is exactly what
// the lazy registry exists to prevent.
//
// Plain text is registered eagerly by the registry itself
// (src/core/parsers/index.ts) and is deliberately not here.
import { registerLazyParser } from '../../core/parsers';

registerLazyParser(['docx'], async () => (await import('./docx')).parse);
registerLazyParser(['pdf'], async () => (await import('./pdf')).parse);
registerLazyParser(['odt'], async () => (await import('./odt')).parse);
registerLazyParser(['csv'], async () => (await import('./csv')).parse);
