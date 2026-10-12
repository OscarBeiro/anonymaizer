// Actual UI acceptance through Chrome DevTools Protocol; no browser test dependency.
// Start isolated Chrome with --remote-debugging-port=9222, serve dist on :4173,
// then run with Node 22. Set M9_URL=file:///.../dist-portable/index.html for offline checks.
import { mkdir, readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.M9_URL ?? 'http://127.0.0.1:4173/app';
const portable = base.startsWith('file:');
const downloads = `/tmp/anonymaizer-m9-downloads-${Date.now()}`;
await mkdir(downloads, { recursive: true });
const target = await (await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent(base), { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0; const pending = new Map(); const errors = []; const requests = [];
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.id) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description ?? ''));
  if (msg.method === 'Network.requestWillBeSent') requests.push(msg.params.request);
  if (msg.method === 'Page.javascriptDialogOpening') void call('Page.handleJavaScriptDialog', { accept: true });
  if (msg.method === 'Fetch.requestPaused') void call('Fetch.failRequest', { requestId: msg.params.requestId, errorReason: 'InternetDisconnected' });
});
const call = (method, params = {}) => new Promise((resolve, reject) => { const serial = ++id; pending.set(serial, { resolve, reject }); ws.send(JSON.stringify({ id: serial, method, params })); });
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const wait = async (predicate, label) => {
  for (let i = 0; i < 100; i++) { if (await evaluate(predicate)) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Timed out: ' + label + '\n' + await evaluate('document.body.innerText'));
};
const click = async text => {
  await evaluate(`(() => { const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim() === ${JSON.stringify(text)}); if (!e || e.disabled) throw new Error('Missing/disabled button: ' + ${JSON.stringify(text)}); e.scrollIntoView({behavior:'instant',block:'center'}); e.click(); })()`);
};
const type = async (selector, text) => {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await call('Input.insertText', { text });
};
try {
  await call('Runtime.enable'); await call('Page.enable'); await call('Network.enable');
  await call('Network.setBypassServiceWorker', { bypass: true });
  if (portable) await call('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  else await call('Browser.grantPermissions', { origin: new URL(base).origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await call('Page.reload');
  await wait("!!document.querySelector('textarea[placeholder^=\"Paste plain\"]')", 'app mount');
  const fixture = '# Clinical note\n\nContact Alice Regression at private-m9@example.com.\n\n- Item one\n  - Nested item\n\n| Field | Value |\n| --- | --- |\n| Status | Reviewed |';
  await type('textarea[placeholder^="Paste plain"]', fixture);
  await click('Quick — anonymize now');
  await wait("document.body.innerText.includes('Detection complete.')", 'bounded detection');
  const text = await evaluate("document.querySelector('.quick-result .sanitized-highlight').textContent");
  assert(!text.includes('private-m9@example.com'));
  const token = text.match(/\[\[V1_[A-F0-9]{32}_EMAIL_\d+\]\]/)?.[0]; assert(token);
  const ack = "[...document.querySelectorAll('label')].find(e=>e.textContent.includes('I reviewed these findings'))?.querySelector('input')";
  await evaluate(`(${ack})?.click()`);
  if (!portable) {
    await click('Copy'); await wait("document.body.innerText.includes('Copied.')", 'clipboard success');
    assert.equal(await evaluate('navigator.clipboard.readText()'), text);
  }
  await evaluate("document.querySelector('select[aria-label=\"Export format\"]').value='html'; document.querySelector('select[aria-label=\"Export format\"]').dispatchEvent(new Event('change',{bubbles:true}))");
  await click('Save as…');
  await wait("document.body.innerText.includes('Output handed to the browser.')", 'HTML delivery');
  await new Promise(r => setTimeout(r, 300));
  const htmlName = (await readdir(downloads)).find(n => n.endsWith('.html')); assert.equal(htmlName, 'anonymaizer-sanitized.html');
  const html = await readFile(downloads + '/' + htmlName, 'utf8');
  assert(html.includes('<h1>Clinical note</h1>')); assert(html.includes('<table>')); assert(html.match(/<ul>/g).length === 2); assert(!html.includes('private-m9@example.com'));
  await click('Fine-tune…');
  await wait("!!document.querySelector('section[aria-label=\"Review original occurrences\"] textarea')", 'Advanced review');
  await click('2.2 Sanitized text');
  if (!portable) {
    await click('Copy sanitized text');
    await wait("document.body.innerText.includes('Copied.')", 'Advanced panel copy');
    assert.equal(await evaluate('navigator.clipboard.readText()'), text);
    await evaluate("[...document.querySelectorAll('.step-footer button')].find(e=>e.textContent.trim()==='Copy sanitized text')?.click()");
    await wait("document.querySelector('.step-footer-done') !== null", 'Advanced footer copy');
  }
  await type('input[type="password"]', 'm9 café synthetic password');
  await click('Save private restoration key');
  await wait("document.body.innerText.includes('Key handed to the browser.')", 'encrypted key');
  await new Promise(r => setTimeout(r, 300));
  const key = await readFile(downloads + '/anonymaizer-private-key.json', 'utf8'); assert(!key.includes('private-m9@example.com'));
  await call('Page.reload');
  await wait("!!document.querySelector('textarea[placeholder^=\"Paste plain\"]')", 'ephemeral restart');
  assert.equal(await evaluate("document.querySelector('textarea[placeholder^=\"Paste plain\"]').value"), '');
  await type('input[type="password"]', 'm9 café synthetic password');
  await evaluate(`(() => { const dt=new DataTransfer(); dt.items.add(new File([${JSON.stringify(key)}], 'anonymaizer-private-key.json', {type:'application/json'})); const e=document.querySelector('input[type=file][accept=".json"]'); e.files=dt.files; e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await wait("document.body.innerText.includes('Key loaded.')", 'key import without original document');
  await type('textarea[placeholder="Paste the AI\'s response here…"]', '# AI summary\n\nContact ' + token + '\n\n![resource](https://private-m9.invalid/' + token + ')');
  await click('3.2 Restored text');
  await wait("!!document.querySelector('.restored-html')", 'restore rendering');
  const restored = await evaluate("document.querySelector('.restored-html').textContent");
  assert(restored.includes('private-m9@example.com')); assert.equal(await evaluate("document.querySelector('.restored-html img, .restored-html a, .restored-html script') !== null"), false);
  if (!portable) {
    await click('Copy restored text');
    const types = await evaluate('navigator.clipboard.read().then(items => items[0].types)');
    assert(types.includes('text/html') && types.includes('text/plain'));
    assert((await evaluate('navigator.clipboard.read().then(items=>items[0].getType("text/html")).then(blob=>blob.text())')).includes('<h1>AI summary</h1>'));
  }
  assert.equal(await evaluate("localStorage.getItem('anonymaizer.session')"), null);
  assert(!requests.some(r => JSON.stringify(r).includes('private-m9@example.com') || r.url.includes('private-m9.invalid')));
  if (portable) assert(!requests.some(r => /^https?:/.test(r.url)));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ target: base, passed: ['Standard worker scan', 'Advanced review', 'semantic HTML download', 'encrypted key download', 'ephemeral reload', 'key import without source', 'structured restoration', 'inert resources', 'request containment', ...(!portable ? ['clipboard content', 'Advanced copy routes', 'rich clipboard MIME types'] : ['network denied'])], downloadDirectory: downloads }, null, 2));
} finally { ws.close(); await fetch('http://127.0.0.1:9222/json/close/' + target.id); }
