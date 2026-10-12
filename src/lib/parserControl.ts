import type { ParserControl } from '../core/parsers';
import ArchiveWorker from '../workers/archiveGuard.worker?worker&inline';
export class ParseControl implements ParserControl {
  private cancelled = false;
  private listeners = new Set<() => void>();
  isCancelled = (): boolean => this.cancelled;
  onCancel = (callback: () => void): (() => void) => { this.listeners.add(callback); if (this.cancelled) callback(); return () => this.listeners.delete(callback); };
  cancel(): void { this.cancelled = true; [...this.listeners].forEach(f => f()); this.listeners.clear(); }
}
export const guardArchive = (bytes: ArrayBuffer, control?: ParserControl): Promise<void> => new Promise((resolve, reject) => {
  const worker = new ArchiveWorker();
  let stopListening: (() => void) | undefined;
  const finish = (error?: Error) => { clearTimeout(timer); stopListening?.(); worker.terminate(); if (error) reject(error); else resolve(); };
  const timer = setTimeout(() => finish(new Error('Archive expansion timed out.')), 10000);
  stopListening = control?.onCancel(() => finish(new DOMException('Import cancelled.', 'AbortError')));
  if (control?.isCancelled()) { finish(new DOMException('Import cancelled.', 'AbortError')); return; }
  worker.onerror = () => finish(new Error('Archive validation failed.'));
  worker.onmessage = (e: MessageEvent<{ ok?: boolean; error?: string }>) => finish(e.data.ok ? undefined : new Error(e.data.error));
  worker.postMessage(bytes);
});
