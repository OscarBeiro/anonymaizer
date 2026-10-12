export const PROCESSING_LIMITS = Object.freeze({ inputBytes: 20_000_000, expandedBytes: 20_000_000, archiveEntries: 2000, entryBytes: 2_000_000, inputCharacters: 2_000_000, mappingCount: 10000, outputCharacters: 4_000_000, detectionMs: 10000, archiveMs: 10000, documentUnits: 1000 });
export class ExpansionBudget {
  private total = 0;
  private entry = 0;
  constructor(entries: number) { if (entries > PROCESSING_LIMITS.archiveEntries) throw new Error('Archive contains too many entries.'); }
  beginEntry(): void { this.entry = 0; }
  add(bytes: number): void {
    this.total += bytes; this.entry += bytes;
    if (this.total > PROCESSING_LIMITS.expandedBytes || this.entry > PROCESSING_LIMITS.entryBytes) throw new Error('Expanded archive exceeds processing limits.');
  }
}
