#!/usr/bin/env node
import { getDocsMirrorConfig } from './docs-mirror-config.mjs';

const config = getDocsMirrorConfig();
const mirrorBaseUrl = `https://${config.domain}`;
const globalBaseUrl = 'https://docs.nextclaw.io';

async function fetchText(url) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    redirect: 'follow',
    signal: globalThis.AbortSignal.timeout(15_000),
  });
  const text = await response.text();

  return {
    ms: Date.now() - startedAt,
    response,
    text,
  };
}

async function resolveARecords() {
  const response = await fetch(
    `https://dns.alidns.com/resolve?name=${config.domain}&type=A`,
    { signal: globalThis.AbortSignal.timeout(10_000) },
  );
  const data = await response.json();

  return (data.Answer ?? [])
    .filter((answer) => answer.type === 1 && typeof answer.data === 'string')
    .map((answer) => answer.data);
}

function requireCheck(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyRequiredChecks() {
  const records = await resolveARecords();
  requireCheck(
    records.includes(config.expectedARecord),
    `DNS A record mismatch: expected ${config.expectedARecord}, got ${records.join(', ') || 'none'}`,
  );

  const health = await fetchText(`${mirrorBaseUrl}/health`);
  requireCheck(health.response.status === 200, `Health returned ${health.response.status}`);
  requireCheck(health.text.includes('"ok":true'), 'Health response did not include ok:true');

  const gettingStarted = await fetchText(`${mirrorBaseUrl}/zh/guide/getting-started`);
  requireCheck(
    gettingStarted.response.status === 200,
    `Getting started page returned ${gettingStarted.response.status}`,
  );
  requireCheck(
    gettingStarted.text.includes('快速开始'),
    'Getting started page did not include expected Chinese content',
  );

  return {
    gettingStartedMs: gettingStarted.ms,
    healthMs: health.ms,
    records,
  };
}

async function measureOptionalGlobalSite() {
  try {
    const globalHealth = await fetchText(`${globalBaseUrl}/zh/guide/getting-started`);

    return {
      ms: globalHealth.ms,
      status: globalHealth.response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

try {
  const required = await verifyRequiredChecks();
  const global = await measureOptionalGlobalSite();

  console.log('Docs mirror verification passed.');
  console.log(`- DNS A: ${config.domain} -> ${required.records.join(', ')}`);
  console.log(`- Health: ${mirrorBaseUrl}/health ${required.healthMs}ms`);
  console.log(`- Page: ${mirrorBaseUrl}/zh/guide/getting-started ${required.gettingStartedMs}ms`);

  if ('ms' in global) {
    console.log(`- Reference: ${globalBaseUrl}/zh/guide/getting-started ${global.status} ${global.ms}ms`);
  } else {
    console.log(`- Reference: ${globalBaseUrl} unavailable for comparison: ${global.error}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
