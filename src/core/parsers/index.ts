// M3 seam (P7e): document parsers register themselves here with zero UI
// work. Takes ArrayBuffer + a filename string, never a File — File is a DOM
// type and would break the Capacitor path (CLAUDE.md rule 4). The UI does
// `await file.arrayBuffer()` and passes `file.name`.
//
// This module stays pure: it holds loader thunks, never a library. The
// concrete parsers live in src/lib/parsers/ because mammoth, pdfjs and
// DOMParser are browser code.

import type { DocumentFormat } from '../types';

export interface ParsedDocument {
  markdown: string;
  format: DocumentFormat;
  // Partial-failure channel: an image-only PDF, a dropped email attachment,
  // sheet 7 of 40. Non-blocking — the markdown is still usable.
  warnings?: string[];
}

export type Parser = (bytes: ArrayBuffer, fileName: string) => ParsedDocument | Promise<ParsedDocument>;

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

export const parseDocument = async (fileName: string, bytes: ArrayBuffer): Promise<ParsedDocument> => {
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
  return parser(bytes, fileName);
};

const plainTextParser: Parser = (bytes) => ({
  markdown: new TextDecoder('utf-8').decode(bytes),
  format: 'raw_text',
});

registerParser(['txt', 'md'], plainTextParser);
