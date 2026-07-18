#!/usr/bin/env node
import { resolveCname } from 'node:dns/promises';

const sites = [
  { domain: 'docs.nextclaw.io', name: 'global' },
  { domain: 'docs.nextclaw.net', name: 'domestic' },
];
const routes = ['/', '/zh/', '/zh/guide/getting-started', '/en/', '/en/guide/getting-started'];

function readOption(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requireCheck(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchResponse(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    signal: globalThis.AbortSignal.timeout(20_000),
  });
  requireCheck(response.ok, `${url} returned ${response.status}`);
  return response;
}

async function verifySite(site, expectedCommit, expectedTree) {
  const baseUrl = `https://${site.domain}`;
  const cacheBust = `verify=${Date.now()}`;
  const manifestResponse = await fetchResponse(`${baseUrl}/release-manifest.json?${cacheBust}`);
  const manifest = await manifestResponse.json();

  requireCheck(manifest.schemaVersion === 1, `${site.name} manifest schema is invalid`);
  requireCheck(!expectedCommit || manifest.commit === expectedCommit, `${site.name} commit mismatch`);
  requireCheck(!expectedTree || manifest.treeSha256 === expectedTree, `${site.name} tree hash mismatch`);

  let assetPath;
  for (const route of routes) {
    const html = await (await fetchResponse(`${baseUrl}${route}?${cacheBust}`)).text();
    requireCheck(/<!doctype html>/i.test(html), `${site.name}${route} did not return HTML`);
    assetPath ??= html.match(/(?:src|href)="(\/assets\/[^"?]+)"/)?.[1];
  }

  requireCheck(assetPath, `${site.name} pages did not expose an asset path`);
  await fetchResponse(`${baseUrl}${assetPath}?${cacheBust}`);

  return manifest;
}

const expectedCommit = readOption('expected-commit');
const expectedTree = readOption('expected-tree');
const manifests = await Promise.all(
  sites.map((site) => verifySite(site, expectedCommit, expectedTree)),
);

requireCheck(manifests[0].commit === manifests[1].commit, 'Sites report different commits');
requireCheck(manifests[0].treeSha256 === manifests[1].treeSha256, 'Sites report different tree hashes');

const expectedCname = process.env.NEXTCLAW_DOCS_CN_CNAME;
if (expectedCname) {
  const records = await resolveCname('docs.nextclaw.net');
  requireCheck(records.includes(expectedCname), `Domestic CNAME mismatch: ${records.join(', ')}`);
}

console.log(`Docs deployment verified: ${manifests[0].commit} ${manifests[0].treeSha256}`);
