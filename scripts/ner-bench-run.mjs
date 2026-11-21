// Drives headless Chrome (already started with --remote-debugging-port=9237) at the
// dev-server harness page and prints window.__bench.
//   node scripts/ner-bench-run.mjs <model-id> <device> [local-package-folder-under-scripts/.pkg] [baseUrl]
const [model = 'nym-pii-small', device = 'wasm', local = '', base = 'http://localhost:5199'] = process.argv.slice(2);
const endpoint = 'http://127.0.0.1:9237';
const target = await (await fetch(endpoint + '/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((done) => socket.addEventListener('open', done, { once: true }));
let serial = 0; const pending = new Map();
socket.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); } });
const call = (method, params = {}) => new Promise((resolve) => { const id = ++serial; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
await call('Page.navigate', { url: `${base}/scripts/ner-bench.html?model=${model}&device=${device}${local ? `&local=${local}` : ''}` });
for (let i = 0; i < 1800; i++) {
  const r = await call('Runtime.evaluate', { expression: 'JSON.stringify(window.__bench ?? null)' });
  const value = JSON.parse(r.result?.result?.value ?? 'null');
  if (value) { console.log(JSON.stringify(value, null, 2)); break; }
  await new Promise((done) => setTimeout(done, 1000));
}
await fetch(`${endpoint}/json/close/${target.id}`);
process.exit(0);
