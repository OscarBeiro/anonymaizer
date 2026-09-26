import { describe, expect, it } from 'vitest';
import type { MappingSession } from '../types';
import { buildXlsxExport, canExportXlsx, parseMarkdownTables } from './xlsxExport';

const session = (over: Partial<MappingSession> = {}): MappingSession => ({
  sessionId: 'abcdef12-3456',
  createdAt: '2026-09-26T00:00:00Z',
  inputType: 'FILE',
  fileName: 'clientes.xlsx',
  originalFormat: 'xlsx',
  mappings: [],
  rawMarkdown: '',
  anonymizedMarkdown: '',
  ...over,
});

// Well-formedness without a DOM (src/core runs on node): every tag opened is
// closed in order, and no bare & or < survives in text.
const assertWellFormed = (xml: string) => {
  const body = xml.replace(/^<\?xml[^>]*\?>/, '');
  expect(body.replace(/<[^>]*>/g, '')).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)|</);
  const stack: string[] = [];
  for (const [, close, name, selfClose] of body.matchAll(/<(\/?)([A-Za-z:]+)[^>]*?(\/?)>/g)) {
    if (selfClose) continue;
    if (close) expect(stack.pop()).toBe(name);
    else stack.push(name);
  }
  expect(stack).toEqual([]);
};

describe('parseMarkdownTables', () => {
  it('reads a GFM table, unescaping pipes and skipping the delimiter row', () => {
    expect(parseMarkdownTables('| a | b \\| c |\n| --- | --- |\n| 1 | 2 |')).toEqual([
      { name: undefined, rows: [['a', 'b | c'], ['1', '2']] },
    ]);
  });

  it('names each table after the ## heading above it', () => {
    const md = '## Clientes\n\n| a |\n| --- |\n| x |\n\n## Facturas\n\n| b |\n| --- |\n| y |';
    expect(parseMarkdownTables(md).map((t) => t.name)).toEqual(['Clientes', 'Facturas']);
  });

  it('returns nothing for prose', () => {
    expect(parseMarkdownTables('Just | a line\n\nno table here')).toEqual([]);
  });
});

describe('canExportXlsx', () => {
  it('offers xlsx only for tabular sources', () => {
    expect(canExportXlsx(session({ originalFormat: 'csv' }))).toBe(true);
    expect(canExportXlsx(session({ originalFormat: 'xlsx' }))).toBe(true);
    expect(canExportXlsx(session({ originalFormat: 'docx' }))).toBe(false);
    expect(canExportXlsx(session({ originalFormat: 'raw_text', inputType: 'PASTE' }))).toBe(false);
  });
});

describe('buildXlsxExport', () => {
  it('escapes & and < in cells and produces well-formed XML parts', () => {
    const out = buildXlsxExport('| Nombre | Nota |\n| --- | --- |\n| A & B | x < y |', session(), 'sanitized');
    expect(out.fileName).toBe('clientes-sanitized.xlsx');
    expect(out.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const sheet = out.parts['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('A &amp; B');
    expect(sheet).toContain('x &lt; y');
    expect(sheet).toContain('t="inlineStr"');
    for (const xml of Object.values(out.parts)) assertWellFormed(xml);
  });

  it('writes two sheets for a document with two tables', () => {
    const md = '## Clientes\n\n| a |\n| --- |\n| x |\n\n## Facturas\n\n| b |\n| --- |\n| y |';
    const { parts } = buildXlsxExport(md, session(), 'restored');
    expect(parts['xl/worksheets/sheet1.xml']).toBeDefined();
    expect(parts['xl/worksheets/sheet2.xml']).toBeDefined();
    expect(parts['xl/workbook.xml']).toContain('name="Clientes"');
    expect(parts['xl/workbook.xml']).toContain('name="Facturas"');
  });

  it('makes sheet names Excel accepts: no forbidden characters, ≤31 chars, unique', () => {
    const md = '## a/b\n\n| x |\n| --- |\n| 1 |\n\n## a/b\n\n| y |\n| --- |\n| 2 |\n\n## ' + 'n'.repeat(40) + '\n\n| z |\n| --- |\n| 3 |';
    const names = [...buildXlsxExport(md, session(), 'sanitized').parts['xl/workbook.xml'].matchAll(/name="([^"]*)"/g)].map((m) => m[1]);
    expect(names).toEqual(['a_b', 'a_b (2)', 'n'.repeat(31)]);
  });

  it('throws for a source with no table rather than emitting an empty workbook', () => {
    expect(() => buildXlsxExport('Just prose.', session(), 'sanitized')).toThrow(/no table/i);
  });

  it('throws for a non-tabular source, enforcing the rule in core', () => {
    expect(() => buildXlsxExport('| a |\n| --- |\n| b |', session({ originalFormat: 'docx' }), 'sanitized')).toThrow(/csv or xlsx/i);
  });
});
