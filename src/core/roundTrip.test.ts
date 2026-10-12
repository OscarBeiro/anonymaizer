import { describe, expect, it } from 'vitest';
import { anonymize } from './anonymize';
import { applyEnabledMappings } from './apply';
import { freezeSnapshot, identifyMappings, mintToken, TOKEN_GRAMMAR, revisionStatus, validateSnapshot } from './roundTrip';
import { restoreText } from './reverse';
const scope = 'A'.repeat(32);
const rev = { scope, documentId: 'doc', documentRevision: 1, mappingRevision: 1, policyRevision: 1 };
describe('round-trip identities', () => {
  it('preserves tokens and decisions only with matching anchors; does not reuse changed meanings', () => {
    const a = identifyMappings('a@example.com', anonymize('a@example.com', []).mappings, [], scope, 1);
    const b = identifyMappings('b@example.com', anonymize('b@example.com', []).mappings, a.mappings, scope, a.next);
    expect(b.mappings[0].placeholder).not.toBe(a.mappings[0].placeholder);
    const snapshot = freezeSnapshot(rev, 'a', a.mappings, '1');
    a.mappings[0].originalText = 'changed';
    expect(restoreText(snapshot.mappings[0].placeholder, snapshot.mappings).text).toBe('a@example.com');
    expect(validateSnapshot(snapshot)).toEqual(snapshot);
  });
  it('cannot verify revisions from shared tokens or no tokens', () => {
    const s = freezeSnapshot(rev, 'a', [], '1');
    expect(revisionStatus(s)).toBe('unverifiable');
    expect(revisionStatus(s, { scope })).toBe('unverifiable');
    expect(revisionStatus(s, { ...rev, exportId: 'a' })).toBe('verified');
    expect(revisionStatus(s, { exportId: 'b' })).toBe('mismatched');
  });
  it('never replaces an unaccepted occurrence during a toggle', () => {
    const raw = 'Ana Ana';
    const m = { id: 'a', originalText: 'Ana', variants: ['Ana'], placeholder: '[[NAME_001]]', category: 'NAME', enabled: true, source: 'manual' as const, confidence: 1, occurrences: [{ start: 0, end: 3, text: 'Ana' }] };
    expect(applyEnabledMappings(raw, [m])).toBe('[[NAME_001]] Ana');
  });
});

it('mints valid identities for arbitrary dictionary category labels', () => {
  for (const label of ['PROJECT NAME', '9CODE', '日本語', '_private']) expect(TOKEN_GRAMMAR.test(mintToken(scope, label, 1))).toBe(true);
});
