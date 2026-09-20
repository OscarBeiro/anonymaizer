import type { NerEntity } from '../core/ner';
import type { NerWorkerRequest, NerWorkerResponse } from '../workers/ner.worker';

export type NerStatus =
  | { state: 'idle' }
  // Covers both the one-time ~104MB model download/init (progress events
  // carry `detail`) and, on later calls once the worker already holds the
  // model, plain inference — the worker gives us no separate signal for
  // "loaded, now running", so this UI-facing type doesn't invent one.
  | { state: 'loading'; detail?: string }
  | { state: 'ready' }
  | { state: 'error'; message: string };

// Not src/core/ — this creates a real Worker, a DOM/browser API. It exists so
// App.tsx never talks to postMessage/onmessage directly.
export class NerClient {
  private worker: Worker | null = null;

  runNer(text: string, onStatus: (status: NerStatus) => void): Promise<NerEntity[]> {
    return new Promise((resolve, reject) => {
      this.worker ??= new Worker(new URL('../workers/ner.worker.ts', import.meta.url), { type: 'module' });
      const worker = this.worker;

      onStatus({ state: 'loading' });

      const handleMessage = (event: MessageEvent<NerWorkerResponse>) => {
        const msg = event.data;
        if (msg.type === 'progress') {
          onStatus({ state: 'loading', detail: msg.status });
        } else if (msg.type === 'result') {
          worker.removeEventListener('message', handleMessage);
          onStatus({ state: 'ready' });
          resolve(msg.entities);
        } else if (msg.type === 'error') {
          worker.removeEventListener('message', handleMessage);
          onStatus({ state: 'error', message: msg.message });
          reject(new Error(msg.message));
        }
      };

      worker.addEventListener('message', handleMessage);
      const request: NerWorkerRequest = { type: 'run', text };
      worker.postMessage(request);
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
