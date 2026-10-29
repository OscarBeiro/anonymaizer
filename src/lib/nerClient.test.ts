import { afterEach, expect, it, vi } from 'vitest';
import { NerClient } from './nerClient';
class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  terminated = false;
  requests: { requestId: number }[] = [];
  constructor() { super(); FakeWorker.instances.push(this); }
  postMessage(request: { requestId: number }) { this.requests.push(request); }
  terminate() { this.terminated = true; }
  result(requestId: number) { this.dispatchEvent(new MessageEvent('message', { data: { type: 'result', requestId, entities: [] } })); }
}
afterEach(() => { vi.unstubAllGlobals(); FakeWorker.instances = []; });
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
  await expect(second).resolves.toMatchObject({ entities: [] });
  client.terminate();
});
it('rejects an oversized model input before starting a worker', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  await expect(new NerClient().runNer('x'.repeat(100001), vi.fn())).rejects.toThrow('limited');
  expect(FakeWorker.instances).toHaveLength(0);
});
