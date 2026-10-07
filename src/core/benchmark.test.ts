import { describe, expect, it } from 'vitest';
import * as detectors from './detectors';
import { runDetectionPipeline } from './pipeline';
import { applySpans } from './span';
import type { DetectedSpan } from './types';

// L2: a book-length text must not make any detector quadratic. The text is a
// realistic paragraph (names, IDs, contacts, money, companies, some noise)
// repeated to ~3 MB. Budgets are generous (CI machines vary) but a quadratic
// scan over 3 MB blows through them by orders of magnitude.
const PARAGRAPH =
  'Reunión del 12/03/2024 con Laura Ferreiro Iglesias, DNI 12345678Z, y Anxo Nogueira Vidal, DNI 00000000A. ' +
  'Contacto: laura.ferreiro@example.com, +34 612 345 678. Empresa: Acme Consulting, S.L. con IBAN ES9121000418450200051332. ' +
  'Importe total 1.250.000 € más IVA; ver calle Mayor 12, 28013 Madrid. Pedido TG-4821 confirmado. ' +
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore. ';
const TEXT = PARAGRAPH.repeat(Math.ceil(3_000_000 / PARAGRAPH.length));
const BUDGET_MS = 3_000;

const timed = <T>(fn: () => T): { ms: number; result: T } => {
  const t0 = performance.now();
  const result = fn();
  return { ms: performance.now() - t0, result };
};

const entries = Object.entries(detectors).filter(
  ([name]) => name.startsWith('detect') && name !== 'detectNames' || name === 'detectNames',
) as [string, (t: string) => DetectedSpan[]][];

describe('detector time budget on a ~3 MB text (L2)', () => {
  it('has a ~3 MB input', () => expect(TEXT.length).toBeGreaterThan(2_900_000));

  it.each(entries.map(([name]) => name))('%s finishes within budget', (name) => {
    const fn = detectors[name as keyof typeof detectors] as unknown as (t: string) => DetectedSpan[];
    const { ms, result } = timed(() => fn(TEXT));
    expect(Array.isArray(result)).toBe(true);
    expect(ms).toBeLessThan(BUDGET_MS);
  }, 30_000);

  it('runAllDetectors + pipeline finish within budget', () => {
    const { ms, result } = timed(() => runDetectionPipeline(TEXT, detectors.runAllDetectors(TEXT)));
    expect(result.anonymizedText.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(BUDGET_MS * 2);
  }, 60_000);

  it('applySpans scales linearly with the number of spans', () => {
    const spans: DetectedSpan[] = [];
    for (let i = 0; i + 10 < TEXT.length; i += 20) {
      spans.push({ start: i, end: i + 5, category: 'NAME', text: TEXT.slice(i, i + 5), confidence: 1, source: 'regex', rung: 1 });
    }
    const { ms, result } = timed(() => applySpans(TEXT, spans, () => '[[X]]'));
    expect(result.startsWith('[[X]]')).toBe(true);
    expect(result.length).toBe(TEXT.length);
    expect(ms).toBeLessThan(BUDGET_MS);
  }, 30_000);
});
