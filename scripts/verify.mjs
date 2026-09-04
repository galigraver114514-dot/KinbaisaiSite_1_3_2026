import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* 一键回归检查：chrome 缓存安装 → 桌面/移动视口 → CDP 断言 → PASS/FAIL */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageUrl = 'file://' + path.join(root, 'index.html');
const port = 9400 + Math.floor(Math.random() * 200);

const ensure = spawnSync(process.execPath, [path.join(root, 'scripts', 'ensure-chrome.mjs')], { encoding: 'utf8' });
if (ensure.status !== 0) { console.error(ensure.stderr || 'ensure-chrome failed'); process.exit(2); }
const chromeBin = ensure.stdout.trim();
if (!chromeBin) { console.error('no chrome binary'); process.exit(2); }

const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = mkdtempSync(path.join(os.tmpdir(), 'kbchk-'));
const chrome = spawn(chromeBin, [
  '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  '--window-size=1440,810',
  pageUrl
], { stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', () => {});

let ws;
const pending = new Map();
let mid = 0;
const errors = [];

function send(method, params) {
  params = params || {};
  return new Promise((res, rej) => {
    const id = ++mid;
    pending.set(id, { res, rej, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    const d = (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text;
    errors.push(String(d).slice(0, 200));
    return null;
  }
  return r.result && r.result.value;
}
async function rect(sel) {
  return ev('(()=>{const e=document.querySelector(' + JSON.stringify(sel) + ');if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2)};})()');
}
function overlap(a, b) {
  if (!a || !b) return -1;
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return Math.round(x * y);
}
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page;
    } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('devtools target not ready on port ' + port);
}

try {
  const target = await getTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      d.error ? p.rej(new Error('[' + p.method + '] ' + d.error.message)) : p.res(d.result);
    } else if (d.method === 'Runtime.exceptionThrown') {
      errors.push(String(d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text).slice(0, 200));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  for (let i = 0; i < 90; i++) {
    if ((await ev('document.readyState')) === 'complete') break;
    await sleep(100);
  }
  await sleep(8800); // wait for entrance timeline (door at 6.5s)
  // wait until door unlocked (heavy load may delay entrance)
  for (let i = 0; i < 60; i++) {
    const locked = await ev('document.getElementById("door").classList.contains("locked")');
    if (locked === false) break;
    await sleep(100);
  }

  // --- desktop 1440x810 ---
  const overflow0 = await ev('document.documentElement.scrollWidth - innerWidth');
  check('desktop: no horizontal overflow', overflow0 === 0, 'overflow=' + overflow0);
  const t0 = await ev('document.getElementById("timer").textContent');
  const op0 = await ev('parseFloat(getComputedStyle(document.getElementById("timerBox")).opacity)');
  check('desktop: timer hidden before curse', t0 === '--:--' && op0 === 0, 'text=' + t0 + ' opacity=' + op0);

  const d0 = await rect('#door');
  await clickAt(d0.cx, d0.cy);   // 1st click -> warn
  await sleep(950);
  const warnTxt = await ev('document.getElementById("door").textContent');
  check('door: 1st click enters warn phase', warnTxt.indexOf('それでも開けるか') >= 0, warnTxt);

  const d1 = await rect('#door');
  await clickAt(d1.cx, d1.cy);   // 2nd click -> cursed + timer
  await sleep(200);
  const t15 = await ev('document.getElementById("timer").textContent');
  check('timer: starts at 15:00', t15 === '15:00', 'got ' + t15);
  let tDown = null;
  for (let i = 0; i < 30 && !tDown; i++) {
    const v = await ev('document.getElementById("timer").textContent');
    if (v === '14:59') tDown = v;
    else await sleep(100);
  }
  check('timer: ticks down to 14:59', tDown === '14:59', 'got ' + tDown);
  check('timer: no urgent before 1min', (await ev('document.getElementById("timerBox").classList.contains("urgent")')) === false);

  // ripple must expand from the exact click point (700,420)
  await clickAt(700, 420);
  await sleep(120);
  const rr = await rect('#fxRipple');
  const dx = Math.round(700 - rr.cx), dy = Math.round(420 - rr.cy);
  check('ripple: expands from click point', Math.abs(dx) <= 1 && Math.abs(dy) <= 1, 'center dx=' + dx + ' dy=' + dy);

  const timerRect = await rect('#timerBox');
  const tateR = await rect('#tateR');
  const story = await rect('#story');
  check('desktop: timer not over vertical colophon', overlap(timerRect, tateR) === 0, 'ov=' + overlap(timerRect, tateR));
  check('desktop: timer not over story text', overlap(timerRect, story) === 0, 'ov=' + overlap(timerRect, story));

  // --- mobile 390x780 (touch: (pointer:coarse) light mode applies) ---
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  const mOv = await ev('document.documentElement.scrollWidth - innerWidth');
  check('mobile: no horizontal overflow', mOv === 0, 'overflow=' + mOv);
  const mt = await rect('#timerBox');
  const targets = [
    ['festName', '.festName'], ['eyebrow', '.eyebrow'], ['story', '#story'],
    ['mainTitle', '#mainTitle'], ['sideTate', '#sideTate'], ['sealPaper', '.sealPaper'],
    ['inkNote', '.inkNote'], ['venue', '.venue'], ['whisper', '#whisper'], ['door', '#door']
  ];
  let worst = 0, worstName = '';
  for (const [name, sel] of targets) {
    const rr2 = await rect(sel);
    const o = overlap(mt, rr2);
    if (o > worst) { worst = o; worstName = name; }
  }
  check('mobile: timer overlaps no text element', worst === 0, worst > 0 ? worstName + ' ov=' + worst : 'all clear');

  check('runtime: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('runtime: script completed', false, String(e && e.stack || e).slice(0, 400));
}

console.log(results.map(r => (r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.ok ? '' : '  :: ' + (r.detail || ''))).join('\n'));
console.log(results.filter(r => r.ok).length + '/' + results.length + ' passed');
try { chrome.kill('SIGKILL'); } catch (e) {}
try { rmSync(profile, { recursive: true, force: true }); } catch (e) {}
process.exit(results.some(r => !r.ok) ? 1 : 0);