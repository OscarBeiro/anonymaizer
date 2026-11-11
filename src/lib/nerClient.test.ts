import { afterEach, expect, it, vi } from 'vitest';
import { NerClient, NER_IDLE_TIMEOUT_MS } from './nerClient';
import { NER_LONG_DOCUMENT_CHARS, NER_MAX_CHARS } from './nerLimits';
class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  terminated = false;
  requests: { requestId: number }[] = [];
  constructor() { super(); FakeWorker.instances.push(this); }
  postMessage(request: { requestId: number }) { this.requests.push(request); }
  terminate() { this.terminated = true; }
  result(requestId: number) { this.dispatchEvent(new MessageEvent('message', { data: { type: 'result', requestId, entities: [] } })); }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); FakeWorker.instances = []; });
it('separates worker replies by request ID and rejects cancellation once', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const client = new NerClient(); const status = vi.fn();
  const first = client.runNer('A', status);
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  const a = FakeWorker.instances[0];
  const second = client.runNer('B', status);
  const b = FakeWorker.instances[1];
  await rejected;
  expect(a.terminated).toBe(true);
  b.result(a.requests[0].requestId); // wrong request ID cannot consume B
  expect(status.mock.calls.at(-1)?.[0].state).toBe('loading');
  a.result(a.requests[0].requestId); // cancelled listener has been released
  b.result(b.requests[0].requestId);
  await expect(second).resolves.toEqual([]);
  client.terminate();
});
it('rejects an oversized model input before starting a worker', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  await expect(new NerClient().runNer('x'.repeat(NER_MAX_CHARS + 1), vi.fn())).rejects.toThrow('limited');
  expect(FakeWorker.instances).toHaveLength(0);
});
it('asks for confirmation below the size it refuses', () => {
  expect(NER_LONG_DOCUMENT_CHARS).toBeLessThan(NER_MAX_CHARS);
});
it('times out on silence, not on a long scan that keeps reporting windows', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('Worker', FakeWorker);
  const client = new NerClient();
  const run = client.runNer('A', vi.fn());
  const settled = run.then(() => 'done', (e: Error) => e.message);
  const worker = FakeWorker.instances[0];
  const id = worker.requests[0].requestId;
  for (let i = 1; i <= 5; i++) {
    vi.advanceTimersByTime(NER_IDLE_TIMEOUT_MS - 1);
    worker.dispatchEvent(new MessageEvent('message', { data: { type: 'chunk', requestId: id, done: i, total: 9 } }));
  }
  expect(worker.terminated).toBe(false);
  vi.advanceTimersByTime(NER_IDLE_TIMEOUT_MS);
  expect(worker.terminated).toBe(true);
  await expect(settled).resolves.toMatch(/timed out/);
});
