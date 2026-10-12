import { expect, it } from 'vitest';
import { prepareArtifact } from './prepare';
import type { MappingSession } from '../types';
const session: MappingSession = { sessionId: 'doc', createdAt: '2026-10-12', inputType: 'FILE', fileName: 'Secret-Alice.pdf', originalFormat: 'pdf', rawMarkdown: '# Report', anonymizedMarkdown: '# Report', mappings: [], coverage: { format: 'pdf', status: 'review', processedUnits: 1, skippedUnits: 1, warnings: ['Scanned page'], structuralWarnings: [] } };
const input = { session, text: '# Report', kind: 'html' as const, revision: { scope: 'A'.repeat(32), documentId: 'doc', documentRevision: 1, mappingRevision: 1, policyRevision: 1 }, exportId: 'export', engineVersion: '1', review: { revision: 'r', acknowledged: true, scan: 'ready' as const, categoriesOff: 0 }, reversible: true };
it('blocks incomplete scans and unattended partial extraction regardless of acknowledgment', () => {
  expect(() => prepareArtifact({ ...input, review: { ...input.review, scan: 'failed' } })).toThrow('incomplete');
  expect(() => prepareArtifact({ ...input, unattended: true })).toThrow('Review');
  expect(() => prepareArtifact({ ...input, review: { ...input.review, acknowledged: false } })).toThrow('Review');
});
it('prepares immutable neutral upload separately from the private key; realistic output has no snapshot', () => {
  const artifact = prepareArtifact(input);
  expect(artifact.upload.content).toContain('<h1>Report</h1>');
  expect(artifact.upload.content).not.toContain('Secret-Alice');
  expect(Object.isFrozen(artifact.privateSnapshot?.mappings)).toBe(true);
  expect(artifact.report.review).toContain('Scanned page');
  expect(prepareArtifact({ ...input, reversible: false }).privateSnapshot).toBeUndefined();
});
