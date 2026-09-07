// HTML内のインライン<script>を自動抽出してnode --check（行番号計算の手間を廃止）
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/check-inline.mjs <html>'); process.exit(2); }
const html = readFileSync(file, 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, idx = 0, fail = 0;
while ((m = re.exec(html))) {
  idx++;
  const code = m[1];
  if (!code.trim()) continue;
  const tmp = path.join(os.tmpdir(), 'inline-' + path.basename(file) + '-' + idx + '.js');
  writeFileSync(tmp, code);
  const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  rmSync(tmp, { force: true });
  if (r.status !== 0) { fail++; console.error('inline #' + idx + ' FAIL:\n' + String(r.stderr || r.stdout || '').slice(0, 600)); }
}
console.log(fail ? fail + ' inline block(s) FAILED (of ' + idx + ')' : 'all ' + idx + ' inline script block(s) OK');
process.exit(fail ? 1 : 0);