import { applyEnabledMappings } from './apply';
import type { MappingItem, MappingSession } from './types';

export interface Revision {
  scope: string;
  documentId: string;
  documentRevision: number;
  policyRevision: number;
  mappingRevision: number;
}
export interface MappingSnapshot extends Revision {
  version: 1;
  exportId: string;
  engineVersion: string;
  mappings: MappingItem[];
}
export const TOKEN_GRAMMAR = /^\[\[V1_[A-F0-9]{32}_[A-Z][A-Z0-9_]{0,63}_[1-9]\d*\]\]$/;

export const mintToken = (scope: string, category: string, counter: number): string => {
  let label = category.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (!/^[A-Z]/.test(label)) label = 'CUSTOM_' + label;
  label = label.slice(0, 64);
  if (!/^[A-F0-9]{32}$/.test(scope) || !Number.isSafeInteger(counter) || counter < 1) throw new Error('Invalid token identity.');
  return `[[V1_${scope}_${label}_${counter}]]`;
};

/** The adapter supplies cryptographically random scope IDs. Counters never rewind. */
export const identifyMappings = (raw: string, mappings: MappingItem[], previous: readonly MappingItem[], scope: string, next: number) => {
  const identified = mappings.map(m => {
    const old = previous.find(p => p.category === m.category && p.originalText === m.originalText && JSON.stringify(p.variants) === JSON.stringify(m.variants));
    let placeholder = old?.placeholder;
    if (!placeholder || !TOKEN_GRAMMAR.test(placeholder) || raw.includes(placeholder)) {
      do { placeholder = mintToken(scope, m.category, next++); } while (raw.includes(placeholder));
    }
    const anchorsMatch = old && JSON.stringify(old.occurrences) === JSON.stringify(m.occurrences);
    return { ...m, placeholder, enabled: anchorsMatch ? old.enabled : m.enabled };
  });
  return { mappings: identified, next, text: applyEnabledMappings(raw, identified) };
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};
export const freezeSnapshot = (revision: Revision, exportId: string, mappings: readonly MappingItem[], engineVersion: string): MappingSnapshot =>
  deepFreeze(JSON.parse(JSON.stringify({ ...revision, version: 1, exportId, engineVersion, mappings: mappings.filter(m => m.enabled).map(m => ({ ...m, occurrences: undefined })) })) as MappingSnapshot);

/** Tokens alone never prove export provenance. Evidence must be supplied explicitly. */
export const revisionStatus = (selected: MappingSnapshot, evidence?: Partial<Revision> & { exportId?: string }): 'verified' | 'mismatched' | 'unverifiable' => {
  if (!evidence) return 'unverifiable';
  const fields = ['scope', 'documentId', 'documentRevision', 'policyRevision', 'mappingRevision', 'exportId'] as const;
  if (fields.some(k => evidence[k] !== undefined && evidence[k] !== selected[k])) return 'mismatched';
  return fields.every(k => evidence[k] !== undefined) ? 'verified' : 'unverifiable';
};

export const validateSnapshot = (value: unknown): MappingSnapshot => {
  const s = value as MappingSnapshot;
  if (!s || typeof s !== 'object' || s.version !== 1 || !/^[A-F0-9]{32}$/.test(s.scope) ||
    typeof s.documentId !== 'string' || s.documentId.length > 100 || typeof s.exportId !== 'string' || s.exportId.length > 100 ||
    typeof s.engineVersion !== 'string' || s.engineVersion.length > 100 ||
    ![s.documentRevision, s.policyRevision, s.mappingRevision].every(n => Number.isSafeInteger(n) && n >= 0) ||
    !Array.isArray(s.mappings) || s.mappings.length > 10000) throw new Error('Invalid restoration snapshot.');
  const seen = new Set<string>();
  for (const m of s.mappings) {
    if (!m || typeof m.placeholder !== 'string' || !TOKEN_GRAMMAR.test(m.placeholder) || !m.placeholder.startsWith(`[[V1_${s.scope}_`) || seen.has(m.placeholder) ||
      typeof m.id !== 'string' || m.id.length > 200 || typeof m.category !== 'string' || m.category.length > 64 ||
      typeof m.originalText !== 'string' || m.originalText.length > 100000 || !Array.isArray(m.variants) || m.variants.length > 1000 ||
      m.variants[0] !== m.originalText || !m.variants.every(v => typeof v === 'string' && v.length <= 100000) ||
      typeof m.enabled !== 'boolean' || typeof m.confidence !== 'number' || !Number.isFinite(m.confidence) || m.confidence < 0 || m.confidence > 1 ||
      !['regex', 'ner', 'manual', 'dictionary'].includes(m.source)) throw new Error('Invalid restoration mapping.');
    seen.add(m.placeholder);
  }
  return freezeSnapshot(s, s.exportId, s.mappings, s.engineVersion);
};

export interface OutputReview { revision: string; acknowledged: boolean; scan: 'pending' | 'ready' | 'failed'; categoriesOff: number }
export const revisionKey = (session: MappingSession, revision: Revision): string => JSON.stringify([revision, session.coverage]);
export const outputFindings = (session: MappingSession, text: string, review: OutputReview): { blocked: string[]; review: string[] } => {
  const blocked: string[] = [];
  const findings: string[] = [];
  if (!text.trim() || !session.rawMarkdown.trim() || session.coverage?.status === 'empty' || session.coverage?.status === 'failed') blocked.push('No readable document content.');
  if (review.scan !== 'ready') blocked.push('Processing is incomplete. Retry or cancel before exporting.');
  if (text.length > 4_000_000) blocked.push('Generated output exceeds the 4 MB character limit.');
  if (session.coverage?.status === 'review') findings.push(...session.coverage.warnings, ...session.coverage.structuralWarnings);
  if (review.categoriesOff) findings.push(`${review.categoriesOff} sensitive categories are disabled.`);
  if (session.mappings.some(m => !m.enabled)) findings.push('Some detected values were deliberately left visible.');
  if (session.mappings.filter(m => m.enabled).some(m => m.variants.some(v => v && text.includes(v)))) findings.push('An original value remains in the output. Review all occurrences.');
  if (/https?:\/\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:\d[ -]?){13,19}\b/.test(text)) findings.push('Review remaining links, email addresses or long digit sequences.');
  if (/\[\[V1_/.test(session.rawMarkdown)) findings.push('Source contains token-shaped text. Literal tokens may be ambiguous.');
  return { blocked, review: [...new Set(findings)] };
};
