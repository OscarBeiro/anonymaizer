// P40 gate D — offline cold and warm start of the local model, with every
// request to a non-local host blocked and recorded.
//   npm run build && npx vite preview --port 5198 &
//   google-chrome --headless=new --remote-debugging-port=9238 --user-data-dir=<tmp> about:blank &
//   P40_MODEL_DIR=<dir with config.json tokenizer.json tokenizer_config.json int8/model_int8.onnx> \
//   P40_WRONG_FILE=<any other file> node scripts/p40-browser.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';

const endpoint = 'http://127.0.0.1:9238';
const app = 'http://localhost:5198/app';
const dir = process.env.P40_MODEL_DIR;
const wrong = process.env.P40_WRONG_FILE;
const target = await (await fetch(endpoint + '/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(done => socket.addEventListener('open', done, { once: true }));
let serial = 0;
const pending = new Map();
const errors = [];
const blocked = [];
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params;
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(request.url);
    if (!local) blocked.push(request.url);
    void call(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? { requestId } : { requestId, errorReason: 'InternetDisconnected' }).catch(() => {});
  }
  if (message.method === 'Page.javascriptDialogOpening') void call('Page.handleJavaScriptDialog', { accept: true });
});
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const wait = async (expression, attempts = 600) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error('Timed out: ' + expression + '\n' + await evaluate("(document.querySelector('dialog[open] .ner-toggle') ?? document.body).innerText.slice(0, 800)"));
};
const files = async paths => {
  const { root } = await call('DOM.getDocument');
  const { nodeId } = await call('DOM.querySelector', { nodeId: root.nodeId, selector: 'dialog[open] input[type=file]' });
  await call('DOM.setFileInputFiles', { nodeId, files: paths });
};
const open = async () => {
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Settings')).click()`);
  await wait("!!document.querySelector('dialog[open] .ner-toggle')");
};
const text = 'Asistentes:\n- Uxía Seoane\n- Brais Taboada Lema\n- Noelia Rouco\n\nLa reunión fue en Ribadavia.';
const sensitive = ['Noelia Rouco', 'Brais Taboada', 'Ribadavia'];
const paste = value => evaluate(`(() => { const area = document.querySelector('.ingest-step textarea'); const data = new DataTransfer(); data.setData('text/plain', ${JSON.stringify(value)}); area.select(); area.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })); })()`);
const quick = async () => {
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Quick')).click()`);
  await wait("!!document.querySelector('.quick-result')");
  return evaluate("document.querySelector('.quick-result .sanitized-highlight').textContent");
};
const load = async () => {
  await call('Page.navigate', { url: app });
  await wait("!!document.querySelector('.ingest-step textarea')");
};
const passed = [];

try {
  await call('Runtime.enable'); await call('Page.enable'); await call('DOM.enable');
  await call('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await load();
  await evaluate("localStorage.clear(); new Promise((done) => { const r = indexedDB.deleteDatabase('anonymaizer-ner-model-cache'); r.onsuccess = r.onerror = r.onblocked = () => done(true); })");
  await load();

  // Cold, no package: nothing can be enabled and nothing is fetched.
  await open();
  assert.equal(await evaluate("!!document.querySelector('dialog[open] .ner-toggle input[type=file]')"), true);
  assert.equal(await evaluate("!!document.querySelector('dialog[open] .ner-toggle input[type=checkbox]')"), false);
  passed.push('local copy offers a package import, not a download');

  // The multilingual model is offered with its complete size and measured languages.
  const offered = await evaluate("document.querySelector('dialog[open] .ner-model-choice').innerText");
  assert.match(offered, /151 MB download/); assert.match(offered, /experimental/);
  await evaluate("document.querySelectorAll('dialog[open] input[name=ner-model]')[1].click()");
  await wait("document.querySelector('dialog[open] .ner-toggle').innerText.includes('Multilingual PII')");
  passed.push('model choice shows size and tested languages');

  // A wrong file is refused and stores nothing.
  if (wrong) {
    await files([join(dir, 'config.json'), join(dir, 'tokenizer.json'), wrong, join(dir, 'int8', 'model_int8.onnx')]);
    await wait("document.querySelector('dialog[open] .ner-toggle').innerText.includes('does not match')");
    assert.equal(await evaluate("!!document.querySelector('dialog[open] .ner-toggle input[type=checkbox]')"), false);
    passed.push('mismatched file refused');
  }

  await files(['config.json', 'tokenizer.json', 'tokenizer_config.json', 'int8/model_int8.onnx'].map(name => join(dir, name)));
  await wait("document.querySelector('dialog[open] .ner-toggle').innerText.includes('verified and stored')", 1200);
  await wait("!!document.querySelector('dialog[open] .ner-toggle input[type=checkbox]')");
  passed.push('verified package stored');

  await evaluate("document.querySelector('dialog[open]').close()").catch(() => {});
  await load();
  await paste(text);
  const before = await quick();
  const leaked = sensitive.filter(item => before.includes(item));
  assert(leaked.length > 0, 'rules alone must leave something for the model to mask: ' + before);

  await open();
  assert.equal(await evaluate("document.querySelectorAll('dialog[open] input[name=ner-model]')[1].checked"), true, 'choice remembered');
  await wait("!!document.querySelector('dialog[open] .ner-toggle input[type=checkbox]')");
  await evaluate("document.querySelector('dialog[open] .ner-toggle input[type=checkbox]').click()");
  await wait("document.querySelector('dialog[open] .ner-toggle').innerText.includes('scanned all')", 1800);
  const after = await evaluate("document.querySelector('.quick-result .sanitized-highlight').textContent");
  assert(leaked.every(item => !after.includes(item)), 'model masks what rules left: ' + after);
  passed.push('cold start from imported package, offline');

  // Warm start: reload, choice and files persist, no import needed.
  await load();
  await paste(text);
  await open();
  assert.equal(await evaluate("document.querySelectorAll('dialog[open] input[name=ner-model]')[1].checked"), true);
  assert.equal(await evaluate("document.querySelector('dialog[open] .ner-toggle').innerText.includes('already on this device')"), true);
  await wait("!!document.querySelector('dialog[open] .ner-toggle input[type=checkbox]')");
  await evaluate("document.querySelector('dialog[open] .ner-toggle input[type=checkbox]').click()");
  await wait("document.querySelector('dialog[open] .ner-toggle').innerText.includes('scanned all')", 1800);
  passed.push('warm start offline');

  // Deleting frees the model for real.
  await evaluate("[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent.trim() === 'Delete model').click()");
  await wait("!!document.querySelector('dialog[open] .ner-toggle input[type=file]')");
  passed.push('delete removes the model');

  assert.deepEqual(blocked, [], 'no request left this machine');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, externalRequestsBlocked: blocked.length }, null, 2));
} finally {
  socket.close();
  await fetch(endpoint + '/json/close/' + target.id);
}
