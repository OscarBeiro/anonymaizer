import { outputFindings, freezeSnapshot, type MappingSnapshot, type OutputReview, type Revision } from '../roundTrip';
import type { MappingSession } from '../types';
import { buildExport, type ExportFile, type TextExportKind } from './textExport';
export interface PreparedArtifact {
  readonly upload: Readonly<ExportFile>;
  readonly exportId: string;
  readonly report: { readonly blocked: readonly string[]; readonly review: readonly string[] };
  /** Private: never package with upload, include in logs, or pass to transport. */
  readonly privateSnapshot?: MappingSnapshot;
}
/** Runtime-neutral gate consumed by every browser sanitized delivery route. */
export const prepareArtifact = (input: {
  session: MappingSession; text: string; kind: TextExportKind; revision: Revision;
  exportId: string; engineVersion: string; review: OutputReview; reversible: boolean; unattended?: boolean;
}): PreparedArtifact => {
  const findings = outputFindings(input.session, input.text, input.review);
  const upload = buildExport(input.kind, input.text, input.session, 'sanitized', { highlight: true });
  const serialized = outputFindings(input.session, upload.content, input.review);
  const blocked = [...new Set([...findings.blocked, ...serialized.blocked])];
  const review = [...new Set([...findings.review, ...serialized.review])];
  if (blocked.length) throw new Error(blocked.join(' '));
  if (review.length && (input.unattended || !input.review.acknowledged)) throw new Error('Review and acknowledge the current output findings before sharing.');
  return Object.freeze({ upload: Object.freeze(upload), exportId: input.exportId,
    report: Object.freeze({ blocked: Object.freeze(blocked), review: Object.freeze(review) }),
    privateSnapshot: input.reversible ? freezeSnapshot(input.revision, input.exportId, input.session.mappings, input.engineVersion) : undefined });
};
