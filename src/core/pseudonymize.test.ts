import { describe, expect, it } from 'vitest';
import { applyEnabledMappings } from './apply';
import { inferMoneyConvention, parseMoneyAmount } from './money';
import { pseudonymFor, pseudonymMap, renderPseudonymized } from './pseudonymize';
import type { MappingItem, MappingSession } from './types';

const item = (category: string, originalText: string, n = 1, extra: Partial<MappingItem> = {}): MappingItem => ({
  id: `${category}_${n}`,
  originalText,
  placeholder: `[[${category}_${String(n).padStart(3, '0')}]]`,
  category,
  confidence: 1,
  source: 'regex',
  enabled: true,
  variants: [originalText],
  ...extra,
});

const session = (rawMarkdown: string, mappings: MappingItem[], sessionId = 'sess-1'): MappingSession => ({
  sessionId,
  createdAt: '2026-09-26T00:00:00.000Z',
  inputType: 'PASTE',
  originalFormat: 'raw_text',
  mappings,
  rawMarkdown,
  anonymizedMarkdown: applyEnabledMappings(rawMarkdown, mappings),
});

describe('pseudonymFor', () => {
  it('is deterministic for a fixed seed', () => {
    const name = item('NAME', 'Ester Cuni');
    expect(pseudonymFor(name, 'seed-a')).toBe(pseudonymFor(name, 'seed-a'));
    const company = item('COMPANY', 'Acme Consulting, S.L.');
    expect(pseudonymFor(company, 'seed-a')).toBe(pseudonymFor(company, 'seed-a'));
  });

  it('varies with the seed', () => {
    const name = item('NAME', 'Ester Cuni');
    const draws = new Set(['a', 'b', 'c', 'd', 'e'].map((s) => pseudonymFor(name, s)));
    expect(draws.size).toBeGreaterThan(1);
  });

  it('never returns the original name', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(pseudonymFor(item('NAME', 'Ester Cuni'), seed)).not.toBe('Ester Cuni');
    }
  });

  it('keeps the name shape: token count and all-caps', () => {
    expect(pseudonymFor(item('NAME', 'Ester'), 's').split(' ')).toHaveLength(1);
    expect(pseudonymFor(item('NAME', 'Ester Cuni'), 's').split(' ')).toHaveLength(2);
    expect(pseudonymFor(item('NAME', 'Ester Cuni Peirote'), 's').split(' ')).toHaveLength(3);
    const caps = pseudonymFor(item('NAME', 'CUNI PEIROTE ESTER'), 's');
    expect(caps).toBe(caps.toUpperCase());
  });

  it("keeps a company's legal suffix, adds one when it has none", () => {
    expect(pseudonymFor(item('COMPANY', 'Acme Consulting, S.L.'), 's')).toMatch(/, S\.L\.$/);
    expect(pseudonymFor(item('COMPANY', 'Globex SA'), 's')).toMatch(/ SA$/);
    expect(pseudonymFor(item('COMPANY', 'Globex SA'), 's')).not.toContain('Globex');
    expect(pseudonymFor(item('COMPANY', 'Ayuntamiento Industrias'), 's')).toMatch(/ S\.L\.$/);
  });

  it('passes the placeholder through for categories with no plausible fake', () => {
    for (const cat of ['DNI', 'NIE', 'IBAN', 'CREDIT_CARD', 'EMAIL', 'PHONE', 'ADDRESS', 'INVALID_ID', 'CUSTOM']) {
      const m = item(cat, 'whatever');
      expect(pseudonymFor(m, 's')).toBe(m.placeholder);
    }
  });

  it('passes written-out amounts through', () => {
    const m = item('MONEY', 'mil euros');
    expect(pseudonymFor(m, 's')).toBe(m.placeholder);
  });
});

describe('pseudonymFor — MONEY perturbation', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`);

  const band = (original: string, convention: 'ES' | 'EN') => {
    const base = parseMoneyAmount(original, convention)!;
    for (const seed of seeds) {
      const fake = pseudonymFor(item('MONEY', original), seed, { convention });
      const value = parseMoneyAmount(fake, convention)!;
      const ratio = Math.abs(value / base);
      // ±10–25%, with a little slack for rounding to the original precision.
      expect(ratio, `${original} → ${fake}`).toBeGreaterThanOrEqual(0.74);
      expect(ratio, `${original} → ${fake}`).toBeLessThanOrEqual(1.26);
      expect(Math.abs(ratio - 1), `${original} → ${fake}`).toBeGreaterThanOrEqual(0.09);
      expect(Math.sign(value)).toBe(Math.sign(base));
    }
  };

  it('lands in the band', () => {
    band('12.450,00 €', 'ES');
    band('$1,234.56', 'EN');
    band('-$50.00', 'EN');
    band('(1.200 €)', 'ES');
  });

  it('keeps the grouping convention, precision and currency marker', () => {
    for (const seed of seeds) {
      expect(pseudonymFor(item('MONEY', '12.450,00 €'), seed, { convention: 'ES' })).toMatch(/^\d{1,2}\.\d{3},\d{2} €$/);
      expect(pseudonymFor(item('MONEY', '$1,234.56'), seed, { convention: 'EN' })).toMatch(/^\$(?:\d,)?\d{3}\.\d{2}$/);
      expect(pseudonymFor(item('MONEY', 'EUR 1500'), seed, { convention: 'ES' })).toMatch(/^EUR \d{4}$/);
      expect(pseudonymFor(item('MONEY', '2,5 millones de euros'), seed, { convention: 'ES' })).toMatch(/^\d,\d millones de euros$/);
      expect(pseudonymFor(item('MONEY', '(1.200 €)'), seed, { convention: 'ES' })).toMatch(/^\((?:\d\.)?\d{3} €\)$/);
    }
  });

  it('rounds round figures to the same roundness', () => {
    for (const seed of seeds) {
      const fake = pseudonymFor(item('MONEY', '1.250.000 €'), seed, { convention: 'ES' });
      expect(fake).toMatch(/^\d{1,3}(?:\.\d{3})+ €$/);
      expect(fake).toMatch(/0\.000 €$/);
    }
  });

  it('reads an ambiguous amount in the document convention', () => {
    // "$1.234" in an EN document is 1.234 dollars: keeps three decimals' worth of shape.
    const fake = pseudonymFor(item('MONEY', '$1.234'), 's', { convention: 'EN' });
    expect(parseMoneyAmount(fake, 'EN')!).toBeLessThan(2);
  });
});

describe('pseudonymMap', () => {
  it('never gives two mappings the same fake value', () => {
    // Enough names to force collisions in a small pool draw.
    const names = Array.from({ length: 60 }, (_, i) => item('NAME', `Persona${i} Apellido${i}`, i + 1));
    const values = [...pseudonymMap(names, 'seed').values()];
    expect(new Set(values).size).toBe(values.length);
  });

  it('does not reuse a real name from the document as a fake', () => {
    const names = Array.from({ length: 30 }, (_, i) => item('NAME', `Persona${i}`, i + 1));
    const map = pseudonymMap(names, 'seed');
    for (const n of names) expect([...map.values()]).not.toContain(n.originalText);
  });
});

describe('renderPseudonymized', () => {
  const raw = 'Ester Cuni (DNI 12345678Z) pagó 1.234,56 € a Globex SA. Ester Cuni firmó.';
  const mappings = [
    item('NAME', 'Ester Cuni'),
    item('DNI', '12345678Z'),
    item('MONEY', '1.234,56 €'),
    item('COMPANY', 'Globex SA'),
  ];

  it('renders fakes, passthrough placeholders, and is stable per session', () => {
    const s = session(raw, mappings);
    const out = renderPseudonymized(s);
    expect(out).not.toContain('Ester Cuni');
    expect(out).not.toContain('Globex');
    expect(out).not.toContain('1.234,56 €');
    expect(out).toContain('[[DNI_001]]');
    expect(renderPseudonymized(s)).toBe(out);
    // Both mentions of the person get the same fake name.
    const fake = pseudonymMap(mappings, s.sessionId, { convention: inferMoneyConvention(raw) }).get('NAME_1')!;
    expect(out.split(fake)).toHaveLength(3);
  });

  it('leaves a disabled mapping as the original text', () => {
    const s = session(raw, mappings.map((m) => (m.category === 'COMPANY' ? { ...m, enabled: false } : m)));
    expect(renderPseudonymized(s)).toContain('Globex SA');
  });

  it('does not touch the mapping list or the placeholder output', () => {
    const s = session(raw, mappings);
    const before = JSON.stringify(s);
    renderPseudonymized(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('inserts a fake containing "$" literally', () => {
    const s = session('Paid $1,200.00 today', [item('MONEY', '$1,200.00')]);
    expect(renderPseudonymized(s)).toMatch(/^Paid \$(?:\d,)?\d{3}\.\d{2} today$/);
  });
});
