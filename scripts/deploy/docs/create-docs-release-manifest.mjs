#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const manifestFileName = 'release-manifest.json';

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function collectFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, absolutePath));
    } else if (entry.isFile() && entry.name !== manifestFileName) {
      files.push(path.relative(root, absolutePath).split(path.sep).join('/'));
    }
  }

  return files;
}

const distDirectory = path.resolve(readOption('dist', 'apps/docs/.vitepress/dist'));
const commit = readOption('commit', process.env.GITHUB_SHA);
const runUrl = readOption('run-url', 'local');

if (!commit) {
  throw new Error('Missing release commit. Pass --commit or set GITHUB_SHA.');
}

const files = (await collectFiles(distDirectory)).sort();
const treeHash = createHash('sha256');

for (const file of files) {
  const content = await readFile(path.join(distDirectory, file));
  treeHash.update(file).update('\0');
  treeHash.update(createHash('sha256').update(content).digest('hex')).update('\0');
  treeHash.update(String(content.byteLength)).update('\n');
}

const manifest = {
  schemaVersion: 1,
  commit,
  treeSha256: treeHash.digest('hex'),
  fileCount: files.length,
  builtAt: new Date().toISOString(),
  runUrl,
};
const json = `${JSON.stringify(manifest, null, 2)}\n`;

await writeFile(path.join(distDirectory, manifestFileName), json);

console.log(JSON.stringify(manifest));
