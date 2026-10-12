import { describe, expect, it } from 'vitest';
import { restoreText } from './reverse';
import type { MappingItem } from './types';
const token = `[[V1_${'A'.repeat(32)}_CUSTOM_1]]`;
const m = (originalText: string): MappingItem => ({ id: 'a', originalText, placeholder: token, category: 'CUSTOM', confidence: 1, source: 'manual', enabled: true, variants: [originalText] });
describe('literal restoration', () => {
  it.each(['$&', '$1', '$$', "$`", "$'", '[[NAME_001]]', '日本語 💶'])('inserts %s literally once', original => {
    expect(restoreText(token + ' ' + token, [m(original)]).text).toBe(original + ' ' + original);
  });
  it('defaults to exact, scoped tokens and reports unknowns', () => {
    const unknown = token.replace('_1]]', '_11]]');
    const r = restoreText(token + ' ' + unknown + ' CUSTOM_1', [m('secret')]);
    expect(r.text).toBe('secret ' + unknown + ' CUSTOM_1');
    expect(r.report.unknownTokens).toEqual([unknown]);
  });
  it('leaves ambiguous tolerant legacy candidates unresolved', () => {
    const a = { ...m('one'), placeholder: '[[CUSTOM_001]]' };
    const b = { ...m('two'), placeholder: '[[Custom_001]]' };
    expect(restoreText('[custom_1]', [a, b], { legacy: true, tolerant: true }).report.ambiguousCandidates).toEqual(['[custom_1]']);
    expect(restoreText('CUSTOM_1', [a], { legacy: true, tolerant: true }).text).toBe('CUSTOM_1');
  });
});
