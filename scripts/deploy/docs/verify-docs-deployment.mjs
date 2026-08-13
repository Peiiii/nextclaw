#!/usr/bin/env node
import { resolveCname } from 'node:dns/promises';

const sites = [
  { domain: 'docs.nextclaw.io', name: 'global' },
  { domain: 'docs.nextclaw.net', name: 'domestic' },
];
const routes = ['/', '/zh/', '/zh/guide/getting-started', '/en/', '/en/guide/getting-started'];
const fetchAttempts = 4;
const fetchRetryDelayMs = 5_000;
const retryableHttpStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

function readOption(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requireCheck(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function wait(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function fetchResponse(url, attempt = 1) {
  let response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: globalThis.AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (attempt >= fetchAttempts) {
      throw error;
    }

    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[docs-verify] ${url} attempt ${attempt}/${fetchAttempts} failed: ${reason}; retrying`);
    await wait(fetchRetryDelayMs);
    return fetchResponse(url, attempt + 1);
  }

  if (response.ok) {
    return response;
  }

  if (!retryableHttpStatuses.has(response.status) || attempt >= fetchAttempts) {
    throw new Error(`${url} returned ${response.status}`);
  }

  console.warn(`[docs-verify] ${url} attempt ${attempt}/${fetchAttempts} returned ${response.status}; retrying`);
  await wait(fetchRetryDelayMs);
  return fetchResponse(url, attempt + 1);
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
