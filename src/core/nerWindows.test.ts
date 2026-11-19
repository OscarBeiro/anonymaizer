import { describe, expect, it } from 'vitest';
import { chunkText } from './ner';
import { nerCoverage } from './nerWindows';

describe('nerCoverage', () => {
  it('reports a gap as incomplete', () => {
    expect(nerCoverage(100, [{ start: 0, end: 40 }, { start: 60, end: 100 }])).toMatchObject({ coveredChars: 80, complete: false });
  });
  it('reports the chunkText windows of a long document as complete', () => {
    const text = Array.from({ length: 900 }, (_, i) => `palabra${i}`).join(' ');
    const windows = chunkText(text).map((c) => ({ start: c.start, end: c.start + c.text.length }));
    expect(nerCoverage(text.length, windows)).toMatchObject({ complete: true, coveredChars: text.length, windows: windows.length });
  });
});
