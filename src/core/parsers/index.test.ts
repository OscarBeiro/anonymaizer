import { describe, expect, it, vi } from 'vitest';
import type { Parser } from './index';
import { parseDocument, registerLazyParser, registerParser, supportedExtensions } from './index';

const toBytes = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer;

describe('parsers registry', () => {
  it('ships a plain-text parser for .txt and .md', () => {
    expect(supportedExtensions()).toEqual(expect.arrayContaining(['txt', 'md']));
  });

  it('parses .txt into raw_text markdown', async () => {
    const result = await parseDocument('notes.txt', toBytes('hello world'));
    expect(result).toEqual({ markdown: 'hello world', format: 'raw_text' });
  });

  it('parses .md the same way', async () => {
    const result = await parseDocument('notes.md', toBytes('# Title'));
    expect(result).toEqual({ markdown: '# Title', format: 'raw_text' });
  });

  it('lets a new parser register itself with zero changes here', async () => {
    registerParser(['xyz'], (bytes) => ({
      markdown: new TextDecoder().decode(bytes).toUpperCase(),
      format: 'raw_text',
    }));
    const result = await parseDocument('file.XYZ', toBytes('shout'));
    expect(result).toEqual({ markdown: 'SHOUT', format: 'raw_text' });
    expect(supportedExtensions()).toContain('xyz');
  });

  it('rejects an unsupported extension naming the working formats', async () => {
    await expect(parseDocument('report.docx', toBytes('x'))).rejects.toThrow(/\.docx/);
    await expect(parseDocument('report.docx', toBytes('x'))).rejects.toThrow(/txt/);
  });

  it('rejects a file with no extension', async () => {
    await expect(parseDocument('README', toBytes('x'))).rejects.toThrow('README');
  });

  it('round-trips a parser warning', async () => {
    registerParser(['warny'], () => ({
      markdown: 'partial',
      format: 'pdf',
      warnings: ['3 pages had no extractable text'],
    }));
    const result = await parseDocument('scan.warny', toBytes('x'));
    expect(result.warnings).toEqual(['3 pages had no extractable text']);
  });
});

describe('lazily registered parsers', () => {
  const stubParser: Parser = () => ({ markdown: 'lazy', format: 'docx' });

  it('lists the extension without invoking the loader', () => {
    const loader = vi.fn(async () => stubParser);
    registerLazyParser(['lazy1'], loader);
    expect(supportedExtensions()).toContain('lazy1');
    expect(loader).not.toHaveBeenCalled();
  });

  it('invokes the loader exactly once across two parses', async () => {
    const loader = vi.fn(async () => stubParser);
    registerLazyParser(['lazy2'], loader);
    await parseDocument('a.lazy2', toBytes('x'));
    const second = await parseDocument('b.lazy2', toBytes('x'));
    expect(loader).toHaveBeenCalledTimes(1);
    expect(second.markdown).toBe('lazy');
  });

  it('names the format when the loader rejects, instead of leaking a chunk-load error', async () => {
    registerLazyParser(['lazy3'], () => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    await expect(parseDocument('a.lazy3', toBytes('x'))).rejects.toThrow(/\.lazy3/);
    await expect(parseDocument('a.lazy3', toBytes('x'))).rejects.not.toThrow(/dynamically imported/);
  });

  it('retries the loader after a failure rather than caching the rejection', async () => {
    const loader = vi.fn<() => Promise<Parser>>();
    loader.mockRejectedValueOnce(new Error('offline'));
    loader.mockResolvedValueOnce(stubParser);
    registerLazyParser(['lazy4'], loader);
    await expect(parseDocument('a.lazy4', toBytes('x'))).rejects.toThrow();
    await expect(parseDocument('a.lazy4', toBytes('x'))).resolves.toMatchObject({ markdown: 'lazy' });
  });
});
