import { expect, it, vi } from 'vitest';
import { anonymize } from './anonymize';
import { identifyMappings } from './roundTrip';
import { restoreText } from './reverse';
import { prepareArtifact } from './export/prepare';
import type { MappingSession } from './types';
const prepare = (scope: string, incomplete = false) => {
  const raw = 'a@example.com';
  const result = identifyMappings(raw, anonymize(raw, []).mappings, [], scope, 1);
  const session: MappingSession = { sessionId: 'doc', createdAt: '2026-10-12', inputType: 'PASTE', originalFormat: 'raw_text', rawMarkdown: raw, anonymizedMarkdown: result.text, mappings: result.mappings,
    coverage: { format: 'raw_text', processedUnits: 1, skippedUnits: incomplete ? 1 : 0, warnings: incomplete ? ['Image text omitted'] : [], structuralWarnings: [], status: incomplete ? 'review' : 'complete' } };
  return prepareArtifact({ session, text: result.text, kind: 'txt', revision: { scope, documentId: 'doc', documentRevision: 1, policyRevision: 1, mappingRevision: 1 }, exportId: scope, engineVersion: '1', review: { revision: 'r', scan: 'ready', categoriesOff: 0, acknowledged: false }, reversible: true, unattended: true });
};
it('mock transport receives only approved text and cannot obtain another conversation mapping', async () => {
  const a = prepare('A'.repeat(32)); const b = prepare('B'.repeat(32));
  const transport = vi.fn(async (request: { text: string }) => request.text);
  const response = await transport({ text: a.upload.content });
  expect(JSON.stringify(transport.mock.calls)).not.toContain('a@example.com');
  expect(restoreText(response, a.privateSnapshot!.mappings).text).toBe('a@example.com');
  expect(restoreText(response, b.privateSnapshot!.mappings).text).toBe(response);
  expect(restoreText(response, b.privateSnapshot!.mappings).report.unknownTokens).toHaveLength(1);
});
it('incomplete unattended coverage fails before mock transport can run', () => {
  const transport = vi.fn();
  expect(() => { const artifact = prepare('A'.repeat(32), true); transport(artifact.upload); }).toThrow('Review');
  expect(transport).not.toHaveBeenCalled();
});
