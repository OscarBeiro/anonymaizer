// M3 seam (P7e): document parsers register themselves here with zero UI
// work. Takes ArrayBuffer + a filename string, never a File — File is a DOM
// type and would break the Capacitor path (CLAUDE.md rule 4). The UI does
// `await file.arrayBuffer()` and passes `file.name`.
//
// This module stays pure: it holds loader thunks, never a library. The
// concrete parsers live in src/lib/parsers/ because mammoth, pdfjs and
// DOMParser are browser code.

import type { DocumentFormat, ExtractionCoverage } from '../types';

export interface ParsedDocument {
  markdown: string;
  format: DocumentFormat;
  // Partial-failure channel: an image-only PDF, a dropped email attachment,
  // sheet 7 of 40. Non-blocking — the markdown is still usable.
  warnings?: string[];
  coverage?: ExtractionCoverage;
}

export interface ParserControl { isCancelled: () => boolean; onCancel: (callback: () => void) => () => void }

export type Parser = (bytes: ArrayBuffer, fileName: string, control?: ParserControl) => ParsedDocument | Promise<ParsedDocument>;

export type ParserLoader = () => Promise<Parser>;

const loaders = new Map<string, ParserLoader>();
const resolved = new Map<string, Parser>();

const normalize = (ext: string): string => ext.toLowerCase().replace(/^\./, '');

/** For parsers cheap enough to live in the bundle, like plain text. */
export const registerParser = (extensions: string[], parser: Parser): void => {
  for (const ext of extensions) {
    const key = normalize(ext);
    loaders.set(key, () => Promise.resolve(parser));
    resolved.set(key, parser);
  }
};

/** For parsers behind a dynamic `import()`, so their library only downloads on use. */
export const registerLazyParser = (extensions: string[], loader: ParserLoader): void => {
  for (const ext of extensions) {
    loaders.set(normalize(ext), loader);
  }
};

// Answers from the key set alone, so the drop-zone hint never triggers a
// download just by rendering.
export const supportedExtensions = (): string[] => [...loaders.keys()].sort();

const extensionOf = (fileName: string): string => {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();
};

export const parseDocument = async (fileName: string, bytes: ArrayBuffer, control?: ParserControl): Promise<ParsedDocument> => {
  if (bytes.byteLength > 20_000_000) throw new Error('File exceeds the 20 MB import limit.');
  const ext = extensionOf(fileName);
  const loader = loaders.get(ext);
  if (!loader) {
    throw new Error(
      `Unsupported file type "${ext ? `.${ext}` : fileName}". Supported: ${supportedExtensions().join(', ')}`,
    );
  }

  let parser = resolved.get(ext);
  if (!parser) {
    try {
      parser = await loader();
    } catch (cause) {
      // A raw "Failed to fetch dynamically imported module" tells the user
      // nothing; name the format they actually dropped.
      throw new Error(`Could not load the .${ext} parser. Please try again.`, { cause });
    }
    resolved.set(ext, parser);
  }
  if (control?.isCancelled()) throw new Error('Import cancelled.');
  const parsed = await parser(bytes, fileName, control);
  if (control?.isCancelled()) throw new Error('Import cancelled.');
  const warnings = parsed.warnings ?? [];
  if (!parsed.coverage) parsed.coverage = { format: parsed.format, processedUnits: 1, skippedUnits: 0, warnings, structuralWarnings: [],
    status: !parsed.markdown.trim() ? 'empty' : warnings.length ? 'review' : 'complete' };
  if (parsed.format !== 'raw_text' && !['csv'].includes(parsed.format)) {
    const notice = 'Only supported extracted text is included. Images, attachments, metadata and unsupported structure require review of the source. No OCR is performed.';
    parsed.coverage.warnings = [...new Set([...parsed.coverage.warnings, notice])];
    if (parsed.coverage.status === 'complete') parsed.coverage.status = 'review';
  }
  if (parsed.markdown.length > 2_000_000) throw new Error('Extracted text exceeds the processing limit.');
  return parsed;
};

const plainTextParser: Parser = (bytes) => ({
  markdown: new TextDecoder('utf-8').decode(bytes),
  format: 'raw_text',
});

registerParser(['txt', 'md'], plainTextParser);
