// P26 acceptance through an isolated Chrome DevTools endpoint, with no dependencies.
// Run the portable build, start headless Chrome with --remote-debugging-port=9236,
// then: node scripts/p26-browser.mjs
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const endpoint = 'http://127.0.0.1:9236';
const target = await (await fetch(endpoint + '/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(done => socket.addEventListener('open', done, { once: true }));
let serial = 0;
const pending = new Map();
const errors = [];
const network = [];
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
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Network.requestWillBeSent' && /^https?:/.test(message.params.request.url)) network.push(message.params.request.url);
  if (message.method === 'Fetch.requestPaused') void call('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'InternetDisconnected' });
  if (message.method === 'Page.javascriptDialogOpening') void call('Page.handleJavaScriptDialog', { accept: true });
});
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const wait = async expression => {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'));
};
const setup = '.ingest-step .language-region-setup';
const settingsSetup = 'dialog[open] .language-region-setup';
const chip = (name, parent = setup) => `[...document.querySelectorAll(${JSON.stringify(parent + ' label')})].find(label => label.querySelector('span')?.textContent === ${JSON.stringify(name)})?.querySelector('input')`;
const click = async (name, parent = 'body') => {
  await evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(parent + ' button')})].find(item => item.textContent.trim().replace(/^⚙\\s*/, '') === ${JSON.stringify(name)}); if (!button || button.disabled) throw new Error('Button missing: ' + ${JSON.stringify(name)}); button.click(); })()`);
};
const paste = text => evaluate(`(() => { const area = document.querySelector('.ingest-step textarea'); const data = new DataTransfer(); data.setData('text/plain', ${JSON.stringify(text)}); area.select(); area.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })); })()`);
const reload = async () => { await call('Page.reload'); await wait("!!document.querySelector('.ingest-step textarea')"); };
const es = 'El informe es para nuestro equipo y el documento tiene la información que necesita. Por favor revise este documento con sus compañeros cuando tenga tiempo.';
const pt = 'O relatório é para a nossa equipa e o documento tem a informação necessária. Por favor confira os dados com os seus colegas e envie uma resposta quando não houver dúvidas.';

try {
  await call('Runtime.enable'); await call('Page.enable'); await call('Network.enable');
  await call('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await call('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: pathToFileURL(resolve('dist-portable/index.html')).href });
  await wait("!!document.querySelector('.ingest-step textarea')");
  await evaluate("localStorage.clear(); localStorage.setItem('anonymaizer.uiLanguage', 'en')");
  await reload();

  await paste(pt);
  await wait("document.querySelector('.ingest-step .language-region-detected').textContent.includes('Portuguese')");
  assert.equal(await evaluate(`(${chip('Portuguese')}).checked`), true);
  assert.equal(await evaluate(`(${chip('Portuguese')}).disabled`), true);
  assert.equal(await evaluate(`(${chip('Spain')}).checked`), false);
  assert.equal(await evaluate("!!document.querySelector('.ingest-step .language-region-warning')"), true);

  await paste(es + '\n\n' + pt + '\n\nDNI 12345678A. Contact p26@example.com.');
  await wait(`(${chip('Spanish')})?.checked && (${chip('Portuguese')})?.checked && (${chip('Spain')})?.checked`);
  await evaluate(`(${chip('Spain')}).click()`);
  await click('Quick — anonymize now');
  await wait("!!document.querySelector('.quick-result')");
  assert((await evaluate("document.querySelector('.quick-result .sanitized-highlight').textContent")).includes('12345678A'));
  assert(!(await evaluate("document.querySelector('.quick-result .sanitized-highlight').textContent")).includes('p26@example.com'));
  await click('Settings');
  await wait("!!document.querySelector('dialog[open]')");
  await evaluate(`(${chip('Spain', settingsSetup)}).click()`);
  await wait("!document.querySelector('.quick-result .sanitized-highlight').textContent.includes('12345678A')");
  await click('Pin selected packs', settingsSetup);
  const pins = await evaluate("JSON.parse(localStorage.getItem('anonymaizer.pinnedProfile'))");
  assert.deepEqual(new Set(pins.languages), new Set(['es', 'pt']));
  assert.deepEqual(pins.jurisdictions, ['ES']);
  await reload();
  assert.equal(await evaluate(`(${chip('Spanish')}).checked`), true);
  assert.equal(await evaluate(`(${chip('Spain')}).checked`), true);

  // File import takes the same profile route and keeps the user's pins.
  await evaluate(`(() => { const data = new DataTransfer(); data.items.add(new File([${JSON.stringify(pt)}], 'language.txt', {type:'text/plain'})); const input = document.querySelector('.ingest-step input[type=file]'); input.files = data.files; input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await wait("document.querySelector('.ingest-step textarea').value.includes('relatório')");
  assert.equal(await evaluate(`(${chip('Spanish')}).checked`), true);
  assert.equal(await evaluate(`(${chip('Portuguese')}).checked`), true);
  await click('Clear pinned choices', setup);
  await wait(`!(${chip('Spanish')}).checked && !(${chip('Spain')}).checked`);
  await click('Use suggestions', setup);

  // A short Galician document uses pinned packs before the interface locale.
  await evaluate(`(${chip('Galician')}).click(); (${chip('Spain')}).click()`);
  await click('Pin selected packs', setup);
  await paste('Saúdos Xoán García. DNI 12345678Z.');
  await wait(`(${chip('Galician')}).checked && (${chip('Spain')}).checked`);
  await click('Quick — anonymize now');
  await wait("!!document.querySelector('.quick-result')");
  const result = await evaluate("document.querySelector('.quick-result .sanitized-highlight').textContent");
  assert(!result.includes('Xoán García')); assert(!result.includes('12345678Z')); assert(result.includes('Saúdos'));
  await reload();
  await paste(es + '\n\n' + pt);
  await evaluate("document.querySelector('.ingest-step .language-region-setup').scrollIntoView()");
  const desktop = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile('/tmp/p26-desktop.png', Buffer.from(desktop.data, 'base64'));
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate("document.querySelector('.app-main').scrollWidth <= document.querySelector('.app-main').clientWidth"), true);
  const mobile = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile('/tmp/p26-mobile.png', Buffer.from(mobile.data, 'base64'));
  assert.deepEqual(network, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: ['Portuguese coverage notice', 'mixed suggestions', 'region gating and rescan', 'pin persistence', 'file import', 'clear pins', 'short-text pin fallback', 'Galician names and Spanish IDs', 'mobile layout', 'no runtime network requests'], screenshots: ['/tmp/p26-desktop.png', '/tmp/p26-mobile.png'] }, null, 2));
} finally {
  socket.close();
  await fetch(endpoint + '/json/close/' + target.id);
}
