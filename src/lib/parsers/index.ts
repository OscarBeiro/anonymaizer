import { guardArchive } from '../parserControl';
import type { Parser } from '../../core/parsers';
const bounded = (parser: Parser): Parser => async (bytes, name, control) => { await guardArchive(bytes, control); return parser(bytes, name, control); };
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

registerLazyParser(['docx'], async () => bounded((await import('./docx')).parse));
registerLazyParser(['pdf'], async () => (await import('./pdf')).parse);
registerLazyParser(['odt'], async () => bounded((await import('./odt')).parse));
registerLazyParser(['csv'], async () => (await import('./csv')).parse);
registerLazyParser(['xlsx'], async () => bounded((await import('./xlsx')).parse));
registerLazyParser(['eml'], async () => (await import('./eml')).parse);
registerLazyParser(['pptx'], async () => bounded((await import('./pptx')).parse));
