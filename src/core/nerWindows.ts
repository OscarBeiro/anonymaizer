import type { NerEntity } from './ner';

// Token-classification models read a fixed number of tokens; the pipeline
// truncates anything past that silently. These helpers split a document into
// windows that each fit the budget, and put the per-window results back
// together, so the whole document gets model coverage. Pure and tokenizer-free:
// the worker supplies `countTokens`.

export interface NerWindow {
  start: number;
  end: number;
}

export interface NerCoverage {
  totalChars: number;
  coveredChars: number;
  windows: number;
  complete: boolean;
}

export interface PlanOptions {
  /** Token budget per window, special tokens already subtracted. */
  maxTokens: number;
  /** Characters shared between consecutive windows, so a boundary entity is whole in one. */
  overlapChars?: number;
}

const DEFAULT_OVERLAP_CHARS = 200;

export const planNerWindows = (text: string, countTokens: (chunk: string) => number, options: PlanOptions): NerWindow[] => {
  const { maxTokens } = options;
  if (maxTokens < 1) throw new Error('maxTokens must be positive');
  const overlap = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const windows: NerWindow[] = [];
  let start = 0;
  while (start < text.length) {
    // Longest end that still fits: bisect on character length.
    let low = start + 1;
    let high = text.length;
    if (countTokens(text.slice(start, high)) <= maxTokens) low = high;
    else {
      while (low < high) {
        const mid = (low + high + 1) >>> 1;
        if (countTokens(text.slice(start, mid)) <= maxTokens) low = mid;
        else high = mid - 1;
      }
    }
    let end = low;
    if (end < text.length) {
      // Prefer to cut at whitespace in the last quarter of the window.
      const floor = start + Math.max(1, Math.floor((end - start) * 0.75));
      for (let at = end; at > floor; at--) {
        if (/\s/u.test(text[at - 1])) { end = at; break; }
      }
    }
    windows.push({ start, end });
    if (end >= text.length) break;
    let next = Math.max(start + 1, end - overlap);
    while (next < end && next > start + 1 && !/\s/u.test(text[next - 1])) next++;
    start = next >= end ? end : next;
  }
  return windows;
};

export const nerCoverage = (totalChars: number, windows: readonly NerWindow[]): NerCoverage => {
  let covered = 0;
  let reach = 0;
  for (const { start, end } of [...windows].sort((a, b) => a.start - b.start)) {
    if (end > Math.max(reach, start)) covered += end - Math.max(reach, start);
    reach = Math.max(reach, end);
  }
  return { totalChars, coveredChars: covered, windows: windows.length, complete: covered >= totalChars };
};

/**
 * Merges per-window entities (already in document offsets). Overlapping hits
 * of the same group become one span over their union with the best score;
 * overlapping hits of different groups keep the more confident one (longer on
 * a tie). Output is sorted and deterministic.
 */
export const reconcileNerEntities = (text: string, entities: readonly NerEntity[]): NerEntity[] => {
  const sorted = [...entities].sort((a, b) => a.start - b.start || b.end - a.end || a.entityGroup.localeCompare(b.entityGroup));
  const merged: NerEntity[] = [];
  for (const entity of sorted) {
    const last = merged[merged.length - 1];
    if (!last || entity.start >= last.end) { merged.push({ ...entity }); continue; }
    if (last.entityGroup === entity.entityGroup) {
      last.end = Math.max(last.end, entity.end);
      last.score = Math.max(last.score, entity.score);
      last.text = text.slice(last.start, last.end);
    } else if (entity.score > last.score || (entity.score === last.score && entity.end - entity.start > last.end - last.start)) {
      merged[merged.length - 1] = { ...entity };
    }
  }
  return merged;
};

/** Shifts a window's entities from window-relative to document offsets. */
export const offsetNerEntities = (entities: readonly NerEntity[], by: number): NerEntity[] =>
  entities.map((entity) => ({ ...entity, start: entity.start + by, end: entity.end + by }));
