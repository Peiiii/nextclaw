import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(app, '.publish');
const concepts = ['bibo-site', 'bibo-sprite-site', 'bibo-navigator-site',
  'bibo-workshop-site', 'bibo-edge-site', 'bibo-orbit-site'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(app, 'dist'), output, { recursive: true });
for (const [index, name] of concepts.entries()) {
  await cp(path.join(app, '..', name, 'dist'),
    path.join(output, 'concepts', String.fromCharCode(97 + index)), { recursive: true });
}
await writeFile(path.join(output, '_headers'),
  '/concepts/*\n  X-Robots-Tag: noindex\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
await writeFile(path.join(output, '404.html'),
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bibo · 页面未找到</title><body><main><h1>这个画面还不存在。</h1><a href="/">回到 Bibo</a></main></body></html>');
console.log(`Bibo: root + ${concepts.length} independent concepts → ${output}`);
