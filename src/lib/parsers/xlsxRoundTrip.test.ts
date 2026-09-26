import { describe, expect, it } from 'vitest';
import { buildXlsxExport } from '../../core/export/xlsxExport';
import type { MappingSession } from '../../core/types';
import { zipXlsxParts } from '../xlsxZip';
import { parse } from './xlsx';

// Lives under src/lib/parsers/ for the DOM environment the importer needs.
// Feeding the export back through the M3 importer is the real specification
// of "valid enough" (M4a/P10).

const session: MappingSession = {
  sessionId: 'abcdef12',
  createdAt: '2026-09-26T00:00:00Z',
  inputType: 'FILE',
  fileName: 'clientes.csv',
  originalFormat: 'csv',
  mappings: [],
  rawMarkdown: '',
  anonymizedMarkdown: '',
};

describe('.xlsx export round trip', () => {
  it('comes back out of the importer cell for cell', async () => {
    const md = [
      '## Clientes',
      '',
      '| Nombre | Nota | Código |',
      '| --- | --- | --- |',
      '| [[NAME_001]] | A & B <c> "q" | 007 |',
      '| [[NAME_002]] | pipe \\| inside |  |',
      '',
      '## Facturas',
      '',
      '| Numero |',
      '| --- |',
      '| F-001 |',
    ].join('\n');
    const { parts } = buildXlsxExport(md, session, 'sanitized');
    const { markdown, warnings } = await parse(await zipXlsxParts(parts), 'out.xlsx');
    expect(warnings).toBeUndefined();
    expect(markdown).toBe(md);
  });
});
