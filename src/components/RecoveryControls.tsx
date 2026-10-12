import { generation } from '../lib/retention';
import { useEffect, useRef, useState } from 'react';
import type { MappingSnapshot } from '../core/roundTrip';
import { decryptRestorationKey, encryptRestorationKey } from '../lib/restorationKey';
import { downloadFile } from '../lib/download';
interface Props { snapshots: MappingSnapshot[]; selected: string; onSelect: (id: string) => void; onLoad: (snapshot: MappingSnapshot) => void }
export function RecoveryControls({ snapshots, selected, onSelect, onLoad }: Props) {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const input = useRef<HTMLInputElement>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await work(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Key operation failed.'); }
    finally { setBusy(false); setPassword(''); }
  };
  return <section className="panel" aria-label="Private restoration keys">
    <h2>Private restoration key</h2>
    <p>Save a key after preparing reversible output. Keep it separate from files you upload. Losing the key or password prevents recovery. Restored documents contain original values.</p>
    <label>Export snapshot <select value={selected} onChange={e => onSelect(e.target.value)} disabled={busy}>
      <option value="">Select an export</option>
      {snapshots.map(s => <option key={s.exportId} value={s.exportId}>{s.exportId.slice(0, 8)} · document {s.documentRevision} · mapping {s.mappingRevision}</option>)}
    </select></label>
    <label>Key password <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
    <button type="button" disabled={busy || !selected || !password} onClick={() => void run(async () => {
      const snapshot = snapshots.find(s => s.exportId === selected);
      if (!snapshot) throw new Error('Select a snapshot first.');
      const capturedGeneration = generation();
      const file = await encryptRestorationKey(snapshot, password);
      if (!alive.current || generation() !== capturedGeneration) throw new Error('Key export cancelled after data was cleared.');
      downloadFile('anonymaizer-private-key.json', file, 'application/json');
      setMessage('Key handed to the browser. Check that it was saved before discarding this session.');
    })}>Save private restoration key</button>
    <button type="button" disabled={busy || !password} onClick={() => input.current?.click()}>Load restoration key</button>
    <input ref={input} type="file" accept=".json" hidden onChange={e => {
      const file = e.target.files?.[0]; e.target.value = '';
      if (file) void run(async () => {
        if (file.size > 8_010_000) throw new Error('Key file is too large.');
        const capturedGeneration = generation();
        const snapshot = await decryptRestorationKey(await file.text(), password);
        if (!alive.current || generation() !== capturedGeneration) throw new Error('Key import cancelled after data was cleared.');
        onLoad(snapshot); setMessage('Key loaded. Select this snapshot to restore a response without the source document.');
      });
    }} />
    <p role="status" aria-live="polite">{busy ? 'Processing private key…' : message}</p>
  </section>;
}
