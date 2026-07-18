#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

function readOption(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function collectHtmlFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectHtmlFiles(root, path));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(relative(root, path).split(sep).join('/'));
    }
  }

  return files;
}

const dist = readOption('dist');
const domain = readOption('domain');
if (!dist || !domain) {
  throw new Error('Usage: create-cdn-refresh-paths.mjs --dist <directory> --domain <hostname>');
}

const paths = new Set(['/release-manifest.json']);
for (const file of await collectHtmlFiles(dist)) {
  if (file === 'index.html') {
    paths.add('/');
  } else if (file.endsWith('/index.html')) {
    const directoryRoute = `/${file.slice(0, -'index.html'.length)}`;
    paths.add(directoryRoute);
    paths.add(`/${file}`);
  } else {
    paths.add(`/${file.slice(0, -'.html'.length)}`);
    paths.add(`/${file}`);
  }
}

if (paths.size > 1_000) {
  throw new Error(`CDN refresh path count ${paths.size} exceeds the single-request limit`);
}

const baseUrl = new URL(`https://${domain}`);
console.log([...paths].sort().map((path) => new URL(path, baseUrl).href).join('\n'));
