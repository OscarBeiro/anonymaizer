import { describe, expect, it } from 'vitest';
import { applySpans, arbitrateSpans, buildMappings } from './span';
import { RUNG, type DetectedSpan } from './types';

const span = (partial: Partial<DetectedSpan> & Pick<DetectedSpan, 'start' | 'end' | 'text'>): DetectedSpan => ({
  category: 'CUSTOM',
  confidence: 1,
  source: 'regex',
  rung: RUNG.VALIDATED_REGEX,
  ...partial,
});

describe('arbitrateSpans', () => {
  it('drops the whole shorter overlapping candidate, keeping the container', () => {
    const container = span({ start: 0, end: 20, text: 'Rúa Fernando Olmedo 12', category: 'ADDRESS', rung: RUNG.ADDRESS });
    const inner = span({ start: 4, end: 20, text: 'Fernando Olmedo', category: 'NAME', rung: RUNG.NAME });
    expect(arbitrateSpans([inner, container])).toEqual([container]);
  });

  it('prefers a lower rung even when the higher-rung span is shorter', () => {
    const address = span({ start: 0, end: 5, text: 'Calle', category: 'ADDRESS', rung: RUNG.ADDRESS });
    const name = span({ start: 0, end: 20, text: 'Long Name Sequence', category: 'NAME', rung: RUNG.NAME });
    expect(arbitrateSpans([name, address])).toEqual([address]);
  });

  it('within a rung, the longest span wins, ties broken by start offset', () => {
    const shortSpan = span({ start: 0, end: 5, text: 'Banco Santander'.slice(0, 5), rung: RUNG.COMPANY });
    const longSpan = span({ start: 0, end: 18, text: 'Banco Santander SA', rung: RUNG.COMPANY });
    expect(arbitrateSpans([shortSpan, longSpan])).toEqual([longSpan]);
  });

  it('keeps non-overlapping spans', () => {
    const a = span({ start: 0, end: 5, text: 'aaaaa' });
    const b = span({ start: 10, end: 15, text: 'bbbbb' });
    expect(arbitrateSpans([a, b])).toEqual([a, b]);
  });
});

describe('buildMappings', () => {
  it('dedups by exact originalText into one mapping, counters starting at 1', () => {
    const a = span({ start: 0, end: 5, text: 'a@b.com', category: 'EMAIL' });
    const b = span({ start: 10, end: 17, text: 'a@b.com', category: 'EMAIL' });
    const c = span({ start: 20, end: 27, text: 'a@b.com', category: 'EMAIL' });
    const mappings = buildMappings([a, b, c]);
    expect(mappings).toHaveLength(1);
    expect(mappings[0].placeholder).toBe('[EMAIL_1]');
  });

  it('assigns per-category counters in order of first occurrence', () => {
    const first = span({ start: 0, end: 5, text: 'one@x.com', category: 'EMAIL' });
    const second = span({ start: 10, end: 19, text: 'two@x.com', category: 'EMAIL' });
    const mappings = buildMappings([second, first]);
    expect(mappings.map((m) => m.placeholder)).toEqual(['[EMAIL_1]', '[EMAIL_2]']);
    expect(mappings.find((m) => m.originalText === 'one@x.com')?.placeholder).toBe('[EMAIL_1]');
  });
});

describe('applySpans', () => {
  it('substitutes right-to-left so earlier offsets stay valid', () => {
    const text = 'foo bar baz';
    const spans = [
      span({ start: 0, end: 3, text: 'foo' }),
      span({ start: 8, end: 11, text: 'baz' }),
    ];
    const result = applySpans(text, spans, (s) => `[${s.text.toUpperCase()}]`);
    expect(result).toBe('[FOO] bar [BAZ]');
  });
});
