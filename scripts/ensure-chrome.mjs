import { existsSync, mkdirSync, writeFileSync, rmSync, accessSync, constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* headless Chrome をプロジェクト内 .cache/ へ一度だけ取得して使い回す。
   既に揃っていれば何もせずパスを出力する（冪等）。 */

const VER = '152.0.7977.75';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheRoot = path.join(root, '.cache');
const binDir = path.join(cacheRoot, 'chrome-headless-shell-linux64');
const bin = path.join(binDir, 'chrome-headless-shell');
const mark = path.join(cacheRoot, 'ok-' + VER);
const zip = path.join(cacheRoot, 'headless-' + VER + '.zip');

function fail(msg) { console.error('[ensure-chrome] ' + msg); process.exit(1); }

if (existsSync(bin) && existsSync(mark)) { process.stdout.write(bin); process.exit(0); }

mkdirSync(cacheRoot, { recursive: true });
if (existsSync(binDir)) rmSync(binDir, { recursive: true, force: true });

console.error('[ensure-chrome] first setup: downloading chrome-headless-shell ' + VER + ' ...');
const url = 'https://storage.googleapis.com/chrome-for-testing-public/' + VER + '/linux64/chrome-headless-shell-linux64.zip';
const dl = spawnSync('curl', ['-sL', '--max-time', '420', '-C', '-', '-o', zip, url], { stdio: ['ignore', 'inherit', 'inherit'] });
if (dl.status !== 0) fail('download failed (curl exit ' + dl.status + ')');
const uz = spawnSync('unzip', ['-q', '-o', zip, '-d', cacheRoot], { stdio: ['ignore', 'inherit', 'inherit'] });
if (uz.status !== 0) fail('unzip failed');
try { accessSync(bin, constants.X_OK); } catch (e) { fail('binary not found: ' + bin); }
writeFileSync(mark, 'v' + VER + '\n');
process.stdout.write(bin);
