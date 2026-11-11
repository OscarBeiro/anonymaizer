import { describe, expect, it } from 'vitest';
import { anonymize } from './anonymize';
import { applyEnabledMappings } from './apply';
import { mergeMappings, splitMapping } from './mappingEdits';
import type { MappingItem } from './types';

const item = (id: string, text: string, raw: string, extra: Partial<MappingItem> = {}): MappingItem => {
  const start = raw.indexOf(text);
  return {
    id, originalText: text, placeholder: `[[${id.replace(/_(\d+)$/, (_, n: string) => `_${n.padStart(3, '0')}`)}]]`,
    category: id.slice(0, id.lastIndexOf('_')), confidence: 0.6, source: 'regex', enabled: true, variants: [text],
    occurrences: [{ start, end: start + text.length, text }],
    ...extra,
  };
};

describe('mergeMappings', () => {
  const raw = 'Reunión con Marta Souto. Despois chamou M. Souto Rey outra vez.';
  const mappings = [item('NAME_1', 'Marta Souto', raw), item('NAME_2', 'M. Souto Rey', raw), item('EMAIL_1', 'outra', raw)];

  it('keeps every merged entry hidden', () => {
    const merged = mergeMappings(mappings, ['NAME_1', 'NAME_2']);
    expect(merged).toHaveLength(2);
    const name = merged.find((m) => m.category === 'NAME')!;
    expect(name.variants).toEqual(['M. Souto Rey', 'Marta Souto']);
    expect(name.originalText).toBe('M. Souto Rey');
    expect(name.occurrences).toHaveLength(2);
    const text = applyEnabledMappings(raw, merged);
    expect(text).not.toMatch(/Marta|Souto/);
    expect(text).toBe('Reunión con [[NAME_001]]. Despois chamou [[NAME_001]] [[EMAIL_001]] vez.');
  });

  it('falls back to text search when a merged entry has no positions', () => {
    const legacy = [mappings[0], { ...mappings[1], occurrences: undefined }, mappings[2]];
    const merged = mergeMappings(legacy, ['NAME_1', 'NAME_2']);
    expect(merged.find((m) => m.category === 'NAME')!.occurrences).toBeUndefined();
    expect(applyEnabledMappings(raw, merged)).not.toMatch(/Marta|Souto/);
  });

  it('does nothing for one entry or mixed categories', () => {
    expect(mergeMappings(mappings, ['NAME_1'])).toBe(mappings);
    expect(mergeMappings(mappings, ['NAME_1', 'EMAIL_1'])).toBe(mappings);
  });
});

describe('splitMapping', () => {
  it('splits a detected cluster by spelling and keeps both hidden', () => {
    const raw = 'La psicóloga Ester Cuni Peirote firma el informe. Más tarde, Ester Cuni llamó al centro.';
    const { mappings } = anonymize(raw, []);
    const cluster = mappings.find((m) => m.category === 'NAME' && m.variants.length > 1)!;
    expect(cluster).toBeDefined();
    const split = splitMapping(mappings, cluster.id);
    const names = split.filter((m) => m.category === 'NAME');
    expect(names.map((m) => m.originalText).sort()).toEqual(['Ester Cuni', 'Ester Cuni Peirote']);
    expect(new Set(split.map((m) => m.placeholder)).size).toBe(split.length);
    expect(names.every((m) => m.occurrences?.length === 1)).toBe(true);
    expect(applyEnabledMappings(raw, split)).not.toMatch(/Ester|Cuni/);
  });

  it('splitting then merging back hides the same text', () => {
    const raw = 'La psicóloga Ester Cuni Peirote firma el informe. Más tarde, Ester Cuni llamó al centro.';
    const { mappings, anonymizedText } = anonymize(raw, []);
    const cluster = mappings.find((m) => m.variants.length > 1)!;
    const split = splitMapping(mappings, cluster.id);
    const ids = split.filter((m) => m.category === 'NAME').map((m) => m.id);
    const again = applyEnabledMappings(raw, mergeMappings(split, ids));
    expect(again.replace(/\[\[NAME_\d+\]\]/g, '[[N]]')).toBe(anonymizedText.replace(/\[\[NAME_\d+\]\]/g, '[[N]]'));
  });

  it('keeps the legacy shape for mappings without positions', () => {
    const legacy: MappingItem[] = [{ id: 'NAME_1', originalText: 'Ana Rey Sanz', placeholder: '[[NAME_001]]', category: 'NAME', confidence: 0.6, source: 'regex', enabled: true, variants: ['Ana Rey Sanz', 'Ana Rey'] }];
    const split = splitMapping(legacy, 'NAME_1');
    expect(split.map((m) => m.id)).toEqual(['NAME_2', 'NAME_3']);
    expect(split.every((m) => m.occurrences === undefined)).toBe(true);
  });

  it('does nothing for a single spelling or an unknown id', () => {
    const raw = 'Ana Rey';
    const one = [item('NAME_1', 'Ana Rey', raw)];
    expect(splitMapping(one, 'NAME_1')).toBe(one);
    expect(splitMapping(one, 'nope')).toBe(one);
    // Two variants, one of which never appears as written.
    const normalised = [item('NAME_1', 'Ana Rey', raw, { variants: ['Ana Rey', 'Rey, Ana'] })];
    expect(splitMapping(normalised, 'NAME_1')).toBe(normalised);
  });
});
