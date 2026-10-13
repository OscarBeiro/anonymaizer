import { expect, it, vi } from 'vitest';
import { NerQueue } from './nerQueue';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

it('finishes loading, discards stale output, and scans the newest document/settings', async () => {
  const download = deferred();
  const output = vi.fn();
  const scan = vi.fn(async (text: string, isCurrent: () => boolean) => {
    if (text === 'initial') await download.promise;
    if (isCurrent()) output(text);
  });
  const queue = new NerQueue(scan);
  queue.submit('initial');
  queue.submit('edited');
  queue.submit('latest import');
  expect(scan).toHaveBeenCalledTimes(1);
  download.resolve();
  await vi.waitFor(() => expect(output).toHaveBeenCalledExactlyOnceWith('latest import'));
  expect(scan.mock.calls.map(([text]) => text)).toEqual(['initial', 'latest import']);
});

it('does not publish a scan after disabling or deleting the model', async () => {
  const download = deferred();
  const output = vi.fn();
  const queue = new NerQueue(async (_: string, isCurrent) => {
    await download.promise;
    if (isCurrent()) output();
  });
  queue.submit('initial');
  queue.submit('pending');
  queue.invalidate();
  download.resolve();
  await download.promise;
  expect(output).not.toHaveBeenCalled();
});

it('continues with the latest request after a failed scan', async () => {
  const download = deferred();
  const output = vi.fn();
  const queue = new NerQueue(async (text: string, isCurrent) => {
    if (text === 'initial') { await download.promise; throw new Error('failed'); }
    if (isCurrent()) output(text);
  });
  queue.submit('initial');
  queue.submit('latest');
  download.resolve();
  await vi.waitFor(() => expect(output).toHaveBeenCalledExactlyOnceWith('latest'));
});
