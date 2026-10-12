/// <reference lib="webworker" />
import JSZip from 'jszip';
import { ExpansionBudget } from '../core/processingLimits';
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const zip = await JSZip.loadAsync(event.data);
    const entries = Object.values(zip.files).filter(e => !e.dir);
    const budget = new ExpansionBudget(entries.length);
    for (const entry of entries) {
      budget.beginEntry();
      await new Promise<void>((resolve, reject) => {
        // JSZip's public stream helper is shipped at runtime but omitted from its declarations.
        const stream = (entry as unknown as { internalStream(type: string): { on(event: 'data', callback: (chunk: Uint8Array) => void): void; on(event: 'end', callback: () => void): void; on(event: 'error', callback: (error: Error) => void): void; pause(): void; resume(): void } }).internalStream('uint8array');
        stream.on('data', chunk => { try { budget.add(chunk.length); } catch (e) { stream.pause(); reject(e); } });
        stream.on('end', resolve); stream.on('error', reject); stream.resume();
      });
    }
    postMessage({ ok: true });
  } catch { postMessage({ error: 'Archive is unreadable or exceeds expansion limits (2000 entries, 2 MB per entry, 20 MB expanded).' }); }
};
