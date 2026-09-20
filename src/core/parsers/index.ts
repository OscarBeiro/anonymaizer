// M3 seam (P7e): document parsers register themselves here with zero UI
// work. Takes ArrayBuffer + a filename string, never a File — File is a DOM
// type and would break the Capacitor path (CLAUDE.md rule 4). The UI does
// `await file.arrayBuffer()` and passes `file.name`.

export interface ParsedDocument {
  markdown: string;
  format: string;
}

export type Parser = (bytes: ArrayBuffer, fileName: string) => ParsedDocument | Promise<ParsedDocument>;

const registry = new Map<string, Parser>();

export const registerParser = (extensions: string[], parser: Parser): void => {
  for (const ext of extensions) {
    registry.set(ext.toLowerCase().replace(/^\./, ''), parser);
  }
};

export const supportedExtensions = (): string[] => [...registry.keys()].sort();

const extensionOf = (fileName: string): string => {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();
};

export const parseDocument = async (fileName: string, bytes: ArrayBuffer): Promise<ParsedDocument> => {
  const ext = extensionOf(fileName);
  const parser = registry.get(ext);
  if (!parser) {
    throw new Error(
      `Unsupported file type "${ext ? `.${ext}` : fileName}". Supported: ${supportedExtensions().join(', ')}`,
    );
  }
  return parser(bytes, fileName);
};

const plainTextParser: Parser = (bytes) => ({
  markdown: new TextDecoder('utf-8').decode(bytes),
  format: 'raw_text',
});

registerParser(['txt', 'md'], plainTextParser);
