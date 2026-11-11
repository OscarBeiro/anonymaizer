import type { NerEntity } from '../core/ner';
import type { NerWorkerRequest, NerWorkerResponse } from '../workers/ner.worker';
import { NER_MAX_CHARS } from './nerLimits';
// M06-02: the worker reports each window it finishes, so the timeout is on
// silence, not on the whole run. A whole-run limit also counted the ~104 MB
// download and cut off long documents that were still making progress.
export const NER_IDLE_TIMEOUT_MS = 180_000;
export type NerStatus = { state: 'idle' } | { state: 'loading'; detail?: string } | { state: 'scanning' } | { state: 'cancelled' } | { state: 'ready' } | { state: 'error'; message: string };
export class NerClient {
  private worker: Worker | null = null;
  private pending = new Map<number, (error: Error) => void>();
  private serial = 0;
  runNer(text: string, onStatus: (status: NerStatus) => void): Promise<NerEntity[]> {
    if (this.pending.size) this.terminate();
    if (text.length > NER_MAX_CHARS) return Promise.reject(new Error(`NER is limited to ${NER_MAX_CHARS.toLocaleString('en')} characters.`));
    const requestId = ++this.serial;
    return new Promise((resolve, reject) => {
      this.worker ??= new Worker(new URL('../workers/ner.worker.ts', import.meta.url), { type: 'module' });
      const worker = this.worker;
      const cleanup = () => { clearTimeout(timer); worker.removeEventListener('message', handleMessage); worker.removeEventListener('error', handleError); this.pending.delete(requestId); };
      const fail = (error: Error) => { cleanup(); onStatus(error.name === 'AbortError' ? { state: 'cancelled' } : { state: 'error', message: error.message }); reject(error); };
      let timer: ReturnType<typeof setTimeout>;
      const watch = () => { clearTimeout(timer); timer = setTimeout(() => { this.terminate(new Error('NER timed out. Output is blocked until retried or disabled.')); }, NER_IDLE_TIMEOUT_MS); };
      watch();
      const handleError = () => this.terminate(new Error('NER worker failed.'));
      const handleMessage = (event: MessageEvent<NerWorkerResponse>) => {
        const msg = event.data;
        if (msg.requestId !== requestId) return;
        watch();
        if (msg.type === 'progress') onStatus({ state: 'loading', detail: msg.status });
        else if (msg.type === 'scanning') onStatus({ state: 'scanning' });
        else if (msg.type === 'result') { cleanup(); onStatus({ state: 'ready' }); resolve(msg.entities); }
        else if (msg.type === 'error') fail(new Error('NER processing failed. Retry or disable the model.'));
      };
      this.pending.set(requestId, fail);
      onStatus({ state: 'loading' });
      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);
      const request: NerWorkerRequest = { type: 'run', requestId, text };
      worker.postMessage(request);
    });
  }
  terminate(error: Error = new DOMException('NER cancelled.', 'AbortError')): void {
    this.worker?.terminate(); this.worker = null;
    [...this.pending.values()].forEach(reject => reject(error)); this.pending.clear();
  }
}
