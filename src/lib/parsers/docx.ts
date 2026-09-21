import mammoth from 'mammoth';
import type { ParsedDocument } from '../../core/parsers';
import { convertHtmlToMarkdown } from '../htmlToMarkdown';

// .docx via mammoth (M3/P8b). Lives in src/lib/, not src/core/, because
// mammoth is browser code — its zip reader resolves through the package's
// `browser` field (browser/unzip.js, which is the entry that accepts
// `arrayBuffer`). Verified at install time: mammoth's tree contains no
// XMLHttpRequest and no fetch, so hard rules 2 and 3 hold.
//
// HTML is an intermediate step, not the output: mammoth speaks HTML, and the
// shared src/lib/htmlToMarkdown.ts is what keeps emphasis markers and escape
// backslashes out of the string the detectors run offsets over (P7f). Do not
// add a second HTML→Markdown library.
//
// Document metadata (core.xml: author, last-modified-by, revision) is not
// extracted. mammoth does not expose it, and the same question is answered
// deliberately for .odt in P8d — the precedent set there governs.

export const parse = async (bytes: ArrayBuffer, fileName: string): Promise<ParsedDocument> => {
  // mammoth's own .d.ts does not export its Result type.
  let result: Awaited<ReturnType<typeof mammoth.convertToHtml>>;
  try {
    result = await mammoth.convertToHtml({ arrayBuffer: bytes });
  } catch (cause) {
    // A truncated or non-OOXML zip surfaces as a jszip/mammoth error whose
    // message says nothing about which file the user dropped.
    throw new Error(`Could not read "${fileName}" — it does not look like a valid Word document.`, { cause });
  }

  const markdown = convertHtmlToMarkdown(result.value).trim();
  const warnings = result.messages.map((message) => message.message);
  if (markdown === '') {
    warnings.push('This document contained no extractable text. Any content it has may be images or embedded objects.');
  }

  return {
    markdown,
    format: 'docx',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
