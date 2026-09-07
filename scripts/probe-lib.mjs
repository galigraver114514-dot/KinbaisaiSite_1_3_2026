// 探針共通ライブラリ：chrome起動→CDP→イベント注入→結果/後始末まで一元化
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageUrl = file => 'file://' + path.join(ROOT, file);

export async function runProbe(file, fn, opts = {}) {
  const port = 9700 + Math.floor(Math.random() * 190);
  const ensure = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'ensure-chrome.mjs')], { encoding: 'utf8' });
  const chromeBin = (ensure.stdout || '').trim();
  if (!chromeBin) { console.error('no chrome'); process.exit(2); }
  const profile = mkdtempSync(path.join(os.tmpdir(), 'kbprobe-'));
  const w = opts.width || 1440, h = opts.height || 900;
  const chrome = spawn(chromeBin, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=' + w + ',' + h, pageUrl(file)],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr.on('data', () => {});
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const results = [];
  const errors = [];
  function check(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  :: ' + (detail || '')));
  }
  let ws, mid = 0; const pending = new Map();
  function send(method, params) {
    params = params || {};
    return new Promise((res, rej) => { const id = ++mid; pending.set(id, { res, rej, method }); ws.send(JSON.stringify({ id, method, params })); });
  }
  async function ev(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { errors.push(String((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text).slice(0, 200)); return null; }
    return r.result && r.result.value;
  }
  async function move(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(x), y: Math.round(y) }); }
  async function walk(x1, y1, x2, y2, step) {
    step = step || 10; const d = Math.hypot(x2 - x1, y2 - y1); const n = Math.max(1, Math.ceil(d / step));
    for (let i = 1; i <= n; i++) { await move(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n); if (i % 3 === 0) await sleep(10); }
  }
  async function click(x, y) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
  }
  async function press(key, code, vk) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  async function rect(sel) {
    return ev("(()=>{const e=document.querySelector('" + sel + "');if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2)}})()");
  }
  async function gcnt() { return ev('document.querySelectorAll(".flyCard").length'); }
  async function liveCard() { const v = await ev('window.__cardFX ? JSON.stringify(window.__cardFX.live()) : null'); return v ? JSON.parse(v) : null; }
  async function waitUntil(expr, msMax) {
    const t0 = Date.now(); while (Date.now() - t0 < (msMax || 2500)) { if (await ev(expr)) return true; await sleep(40); } return false;
  }
  async function getTarget() {
    for (let i = 0; i < 60; i++) {
      try { const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); const p = list.find(t => t.type === 'page'); if (p) return p; } catch (e) {}
      await sleep(200);
    }
    throw new Error('no devtools target on ' + port);
  }
  try {
    const target = await getTarget();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error('[' + p.method + '] ' + d.error.message)) : p.res(d.result); }
      else if (d.method === 'Runtime.exceptionThrown') { errors.push(String((d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description) || d.params.exceptionDetails.text).slice(0, 200)); }
    };
    await send('Runtime.enable'); await send('Page.enable');
    if (opts.emulate) await send('Emulation.setDeviceMetricsOverride', Object.assign({ deviceScaleFactor: 1, mobile: false }, opts.emulate));
    const readyExpr = opts.ready ? ('!!(' + opts.ready + ')') : 'document.readyState === "complete"';
    for (let i = 0; i < 150; i++) { if (await ev(readyExpr)) break; await sleep(100); }
    if (opts.wait) await sleep(opts.wait);
    await fn({ check, ev, send, move, walk, click, press, rect, gcnt, liveCard, waitUntil, sleep, errors });
  } catch (e) { check('runtime', false, String((e && e.stack) || e).slice(0, 300)); }
  const passed = results.filter(r => r.ok).length;
  console.log('RESULT ' + passed + '/' + results.length);
  try { chrome.kill('SIGKILL'); } catch (e) {}
  try { rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  if (opts.exit !== false) process.exit(results.some(r => !r.ok) ? 1 : 0);
  return { ok: results.every(r => r.ok), results };
}