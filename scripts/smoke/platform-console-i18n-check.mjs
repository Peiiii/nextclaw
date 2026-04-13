#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const zhPath = resolve('apps/platform-console/src/i18n/locales/zh-CN.json');
const enPath = resolve('apps/platform-console/src/i18n/locales/en-US.json');

const zh = JSON.parse(readFileSync(zhPath, 'utf8'));
const en = JSON.parse(readFileSync(enPath, 'utf8'));

function collectKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const nested = collectKeys(child, nextPrefix);
      return nested.length > 0 ? nested : [nextPrefix];
    }
    return [nextPrefix];
  });
}

const zhKeys = new Set(collectKeys(zh));
const enKeys = new Set(collectKeys(en));

const onlyZh = [...zhKeys].filter((key) => !enKeys.has(key));
const onlyEn = [...enKeys].filter((key) => !zhKeys.has(key));

if (onlyZh.length > 0 || onlyEn.length > 0) {
  console.error('[platform-console-i18n-check] locale key mismatch detected.');
  if (onlyZh.length > 0) {
    console.error(`Only in zh-CN.json:\n${onlyZh.join('\n')}`);
  }
  if (onlyEn.length > 0) {
    console.error(`Only in en-US.json:\n${onlyEn.join('\n')}`);
  }
  process.exit(1);
}

console.log('[platform-console-i18n-check] locale keys are aligned.');
