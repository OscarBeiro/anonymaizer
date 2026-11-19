// Coverage report for the windows the worker ran (chunking itself lives in
// ner.ts: chunkText). Pure.

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

export const nerCoverage = (totalChars: number, windows: readonly NerWindow[]): NerCoverage => {
  let covered = 0;
  let reach = 0;
  for (const { start, end } of [...windows].sort((a, b) => a.start - b.start)) {
    if (end > Math.max(reach, start)) covered += end - Math.max(reach, start);
    reach = Math.max(reach, end);
  }
  return { totalChars, coveredChars: covered, windows: windows.length, complete: covered >= totalChars };
};
