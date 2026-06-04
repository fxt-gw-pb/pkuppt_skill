'use strict';
/* =============================================================================
 * export_pdf.js — render the built index.html to a 16:9 PDF with headless
 * Chrome over the DevTools protocol (so the CSS @page size is honoured and the
 * red backgrounds/images are kept). No npm dependencies: it auto-detects an
 * installed Chrome/Edge and drives it through Node 24's built-in WebSocket.
 *
 *   node export_pdf.js <index.html | outputDir> [--out output.pdf]
 *
 * If no Chrome binary is found it exits with a clear message and leaves the
 * print-ready index.html (open it and Ctrl/Cmd-P -> Save as PDF, 16:9, no
 * margins, background graphics on).
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

function findChrome() { return CHROME_CANDIDATES.find(p => { try { return fs.existsSync(p); } catch { return false; } }); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* minimal flat-session CDP client over the built-in WebSocket */
async function cdpPrint(chrome, fileUrl, outPdf) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pku-pdf-'));
  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb',
    `--user-data-dir=${tmp}`, '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const to = setTimeout(() => reject(new Error('timed out waiting for Chrome DevTools')), 15000);
    child.stderr.on('data', d => {
      buf += d.toString();
      const m = buf.match(/ws:\/\/[^\s]+/);
      if (m) { clearTimeout(to); resolve(m[0]); }
    });
    child.on('exit', c => { clearTimeout(to); reject(new Error('Chrome exited early (' + c + ')')); });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('ws error'))); });

  let id = 0; const pending = new Map(); const waiters = [];
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
    if (msg.method) waiters.forEach(w => w(msg));
  });
  const send = (method, params, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {}, sessionId })); });
  const waitEvent = (method, sessionId, timeout = 20000) => new Promise((res, rej) => {
    const to = setTimeout(() => { idx(); rej(new Error('timeout ' + method)); }, timeout);
    const fn = msg => { if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) { clearTimeout(to); idx(); res(msg.params); } };
    const idx = () => { const k = waiters.indexOf(fn); if (k >= 0) waiters.splice(k, 1); };
    waiters.push(fn);
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  const loaded = waitEvent('Page.loadEventFired', sessionId);
  await send('Page.navigate', { url: fileUrl }, sessionId);
  await loaded;
  await sleep(700); // let webfonts/SVG settle

  const { data } = await send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    landscape: false, scale: 1,
  }, sessionId);
  fs.writeFileSync(outPdf, Buffer.from(data, 'base64'));

  ws.close(); child.kill('SIGKILL');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { }
  return outPdf;
}

async function exportPdf(input, outArg) {
  const stat = fs.statSync(input);
  const indexPath = stat.isDirectory() ? path.join(input, 'index.html') : input;
  if (!fs.existsSync(indexPath)) throw new Error('index.html not found: ' + indexPath);
  const outPdf = path.resolve(outArg || path.join(path.dirname(indexPath), 'output.pdf'));
  const chrome = findChrome();
  if (!chrome) {
    const msg = 'No Chrome/Edge found. Open ' + indexPath + ' and print to PDF (16:9, no margins, background graphics on). Set CHROME_PATH to override.';
    console.error('⚠ ' + msg);
    return { ok: false, reason: 'no-chrome', message: msg, indexPath };
  }
  const fileUrl = 'file://' + indexPath;
  await cdpPrint(chrome, fileUrl, outPdf);
  return { ok: true, pdf: outPdf, indexPath };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith('--'));
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : null;
  if (!input) { console.error('usage: node export_pdf.js <index.html|dir> [--out file.pdf]'); process.exit(1); }
  exportPdf(path.resolve(input), out)
    .then(r => { if (r.ok) console.log('✓ PDF: ' + r.pdf); else process.exitCode = 2; })
    .catch(e => { console.error('✗ ' + e.message); process.exitCode = 1; });
}

module.exports = { exportPdf, findChrome };
