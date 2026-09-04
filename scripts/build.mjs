import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* 開発版（src/style.css と src/script.js を参照）から
   1ファイル完結の dist/index.html を生成する。
   使い方: node scripts/build.mjs   */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcHtml = path.join(root, 'index.html');
const outDir  = path.join(root, 'dist');
let html = readFileSync(srcHtml, 'utf8');

const cssLink = '<link rel="stylesheet" href="src/style.css">';
const jsRef   = '<script src="src/script.js"></script>';

if (html.indexOf(cssLink) === -1 || html.indexOf(jsRef) === -1) {
  console.error('[build] index.html は src 参照版ではありません（既にインライン?）');
  process.exit(1);
}
const css = readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const js  = readFileSync(path.join(root, 'src', 'script.js'), 'utf8');
html = html.replace(cssLink, '<style>\n' + css + '\n</style>');
html = html.replace(jsRef, '<script>\n' + js + '\n</script>');

mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'index.html');
writeFileSync(out, html + '\n');
console.log('[build] OK -> dist/index.html (' + html.split('\n').length + ' lines, ' + Buffer.byteLength(html) + ' bytes)');
