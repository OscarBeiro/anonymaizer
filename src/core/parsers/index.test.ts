import { describe, expect, it } from 'vitest';
import { parseDocument, registerParser, supportedExtensions } from './index';

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
      format: 'xyz',
    }));
    const result = await parseDocument('file.XYZ', toBytes('shout'));
    expect(result).toEqual({ markdown: 'SHOUT', format: 'xyz' });
    expect(supportedExtensions()).toContain('xyz');
  });

  it('rejects an unsupported extension naming the working formats', async () => {
    await expect(parseDocument('report.docx', toBytes('x'))).rejects.toThrow(/\.docx/);
    await expect(parseDocument('report.docx', toBytes('x'))).rejects.toThrow(/txt/);
  });

  it('rejects a file with no extension', async () => {
    await expect(parseDocument('README', toBytes('x'))).rejects.toThrow('README');
  });
});
