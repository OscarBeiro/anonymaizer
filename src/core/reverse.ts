import type { MappingItem } from './types';

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface RestorationReport {
  restoredOccurrences: number;
  unknownTokens: string[];
  ambiguousCandidates: string[];
  malformedCandidates: string[];
}
export interface RestorationResult { text: string; report: RestorationReport }
export interface RestoreOptions { tolerant?: boolean; legacy?: boolean }

/** One pass over the response. Inserted originals are literal and never rescanned.
 * Merged NAME variants intentionally restore their canonical spelling. Legacy
 * compatibility must be selected; tolerant matching never accepts bare words. */
export const restoreText = (response: string, mappings: readonly MappingItem[], options: RestoreOptions = {}): RestorationResult => {
  const report: RestorationReport = { restoredOccurrences: 0, unknownTokens: [], ambiguousCandidates: [], malformedCandidates: [...response.matchAll(/\[\[(?:V1_|[A-Z][A-Z0-9_]*_\d)[^\]\r\n]*(?:$|\r?\n)/g)].map(m => m[0].trimEnd()) };
  const active = mappings.filter(m => m.enabled && (options.legacy || m.placeholder.startsWith('[[V1_')));
  const patterns = active.map(m => {
    const raw = m.placeholder.slice(2, -2);
    if (!options.tolerant) return escapeRegex(m.placeholder);
    const split = raw.lastIndexOf('_');
    const prefix = escapeRegex(raw.slice(0, split)).replace(/_/g, '[\\s_]+');
    return `\\[{1,2}${prefix}[\\s_]+0*${Number(raw.slice(split + 1))}\\]{1,2}`;
  });
  const regexes = patterns.map(p => new RegExp(`^(?:${p})$`, options.tolerant ? 'iu' : 'u'));
  const candidates = /\[{1,2}[^\][\r\n]{1,200}\]{1,2}/gu;
  const pattern = [...patterns, candidates.source].join('|');
  const text = response.replace(new RegExp(pattern, options.tolerant ? 'giu' : 'gu'), candidate => {
    const hits = active.filter((_, i) => regexes[i].test(candidate));
    if (hits.length > 1) { report.ambiguousCandidates.push(candidate); return candidate; }
    if (hits.length === 1) { report.restoredOccurrences++; return hits[0].originalText; }
    if (/^\[\[(?:V1_|[A-Za-z][A-Za-z0-9_]*_\d)/.test(candidate)) report.unknownTokens.push(candidate);
    else if (/\[.*(?:V1_|[A-Z]+[_ ]\d)/.test(candidate)) report.malformedCandidates.push(candidate);
    return candidate;
  });
  return { text, report };
};

/** Explicit compatibility API for pre-M9 callers. New UI uses restoreText. */
export const reverseText = (response: string, mappings: MappingItem[]): string =>
  restoreText(response, mappings, { legacy: true, tolerant: true }).text;
