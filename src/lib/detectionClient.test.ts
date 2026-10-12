import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ workers: [] as { terminated: boolean; onmessage?: (event: unknown) => void; request?: { requestId: number } }[] }));
vi.mock('../workers/detection.worker?worker&inline', () => ({ default: class {
  terminated = false;
  request?: { requestId: number };
  constructor() { state.workers.push(this); }
  postMessage(r: { requestId: number }) { this.request = r; }
  terminate() { this.terminated = true; }
} }));
import { DetectionClient } from './detectionClient';
afterEach(() => { state.workers.length = 0; vi.useRealTimers(); });
it('terminates timed-out regex work and permits a clean retry', async () => {
  vi.useFakeTimers();
  const client = new DetectionClient();
  const p = client.run({ text: 'A', rules: [], settings: {} }, 10);
  const rejected = expect(p).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(11); await rejected;
  expect(state.workers[0].terminated).toBe(true);
  const retry = client.run({ text: 'B', rules: [], settings: {} });
  const w = state.workers[1];
  w.onmessage?.({ data: { requestId: w.request!.requestId, result: { mappings: [], anonymizedText: 'B' } } });
  await expect(retry).resolves.toMatchObject({ anonymizedText: 'B' });
  expect(w.terminated).toBe(true);
});
it('cancels superseded jobs instead of leaving pending promises/listeners', async () => {
  const client = new DetectionClient();
  const a = client.run({ text: 'A', rules: [], settings: {} });
  const rejectedA = expect(a).rejects.toMatchObject({ name: 'AbortError' });
  const b = client.run({ text: 'B', rules: [], settings: {} });
  const rejectedB = expect(b).rejects.toMatchObject({ name: 'AbortError' });
  client.cancel(); await rejectedA; await rejectedB;
  expect(state.workers.every(w => w.terminated)).toBe(true);
});
