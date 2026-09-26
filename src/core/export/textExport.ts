import type { MappingSession } from '../types';

export type TextExportKind = 'txt' | 'md' | 'html';
export type ExportSide = 'sanitized' | 'restored';

export interface ExportFile {
  fileName: string;
  mimeType: string;
  content: string;
}

// Shared with the on-screen highlighting (MappingPanels) so the saved HTML
// marks exactly what the screen marks.
export const PLACEHOLDER_PATTERN = /(\[\[[A-Z][A-Z0-9_]*\]\])/g;

export const exportFileStem = (session: MappingSession): string => {
  if (session.inputType === 'FILE' && session.fileName) {
    const dot = session.fileName.lastIndexOf('.');
    return dot > 0 ? session.fileName.slice(0, dot) : session.fileName;
  }
  return `anonymaizer-${session.sessionId.slice(0, 8)}`;
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const htmlBody = (text: string, highlight: boolean): string =>
  highlight
    ? text
        .split(PLACEHOLDER_PATTERN)
        .map((seg, i) => (i % 2 === 1 ? `<mark>${escapeHtml(seg)}</mark>` : escapeHtml(seg)))
        .join('')
    : escapeHtml(text);

// Self-contained: inline style, no fonts, links or scripts (hard rules 2 and 3).
const htmlDocument = (title: string, body: string): string => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { margin: 2rem auto; max-width: 50rem; padding: 0 1rem; font: 15px/1.6 system-ui, sans-serif; color: #1f2937; background: #fff; }
pre { white-space: pre-wrap; word-wrap: break-word; font: inherit; margin: 0; }
mark { background: #ede9fe; color: #6d28d9; border-radius: 3px; padding: 0 2px; font-family: ui-monospace, monospace; }
@media (prefers-color-scheme: dark) {
  body { color: #d1d5db; background: #16171d; }
  mark { background: #2e1f4d; color: #c4b5fd; }
}
</style>
</head>
<body>
<pre>${body}</pre>
</body>
</html>
`;

const MIME: Record<TextExportKind, string> = {
  txt: 'text/plain;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  html: 'text/html;charset=utf-8',
};

export const buildExport = (
  kind: TextExportKind,
  text: string,
  session: MappingSession,
  side: ExportSide,
  options: { highlight?: boolean } = {},
): ExportFile => {
  const stem = `${exportFileStem(session)}-${side}`;
  // txt and md are the same bytes: no Markdown stripping, the text may
  // legitimately contain the characters a stripper would eat.
  const content = kind === 'html' ? htmlDocument(stem, htmlBody(text, options.highlight ?? false)) : text;
  return { fileName: `${stem}.${kind}`, mimeType: MIME[kind], content };
};
