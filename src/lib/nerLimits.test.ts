import { describe, expect, it } from 'vitest';
import { isLongForNer, NER_LONG_DOCUMENT_CHARS, nerLongDocumentMessage } from './nerLimits';

describe('NER large-document limit (L3)', () => {
  it('flags text only above the threshold', () => {
    expect(isLongForNer('x'.repeat(NER_LONG_DOCUMENT_CHARS))).toBe(false);
    expect(isLongForNer('x'.repeat(NER_LONG_DOCUMENT_CHARS + 1))).toBe(true);
  });

  it('the message states the size and asks to confirm', () => {
    const msg = nerLongDocumentMessage(2_500_000);
    expect(msg).toContain('2,500k characters');
    expect(msg).toMatch(/Turn it on anyway\?$/);
  });
});
