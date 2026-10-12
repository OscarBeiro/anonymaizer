import DetectionWorker from '../workers/detection.worker?worker&inline';
import type { DetectionRequest } from '../workers/detection.worker';
import type { PipelineResult } from '../core/pipeline';

/** One terminable job; no synchronous regex timeout fallback on the UI thread. */
export class DetectionClient {
  private worker: Worker | null = null;
  private cancelJob: (() => void) | null = null;
  private serial = 0;
  run(input: Omit<DetectionRequest, 'requestId'>, timeout = 10000): Promise<PipelineResult> {
    this.cancel();
    if (input.text.length > 2_000_000) return Promise.reject(new Error('Document exceeds the 2 million character processing limit.'));
    const requestId = ++this.serial;
    return new Promise((resolve, reject) => {
      const worker = new DetectionWorker();
      this.worker = worker;
      const finish = () => { clearTimeout(timer); worker.terminate(); if (this.worker === worker) { this.worker = null; this.cancelJob = null; } };
      const timer = setTimeout(() => { finish(); reject(new Error('Detection timed out. Output is blocked. Simplify dictionary patterns or use a smaller document.')); }, timeout);
      this.cancelJob = () => { finish(); reject(new DOMException('Processing cancelled.', 'AbortError')); };
      worker.onerror = () => { finish(); reject(new Error('Detection worker failed.')); };
      worker.onmessage = (event: MessageEvent<{ requestId: number; result?: PipelineResult; error?: string }>) => {
        if (event.data.requestId !== requestId) return;
        finish();
        if (event.data.result) resolve(event.data.result); else reject(new Error(event.data.error));
      };
      worker.postMessage({ ...input, requestId });
    });
  }
  cancel(): void { this.cancelJob?.(); }
}
