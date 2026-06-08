#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const localesRoot = resolve('packages/nextclaw-ui/src/shared/lib/i18n/locales');
const localeDirs = {
  'zh-CN': resolve(localesRoot, 'zh-CN'),
  'en-US': resolve(localesRoot, 'en-US')
};

function readLocaleFileNames(locale) {
  return readdirSync(localeDirs[locale])
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));
}

function readJson(locale, fileName) {
  return JSON.parse(readFileSync(resolve(localeDirs[locale], fileName), 'utf8'));
}

function collectMessages(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return collectMessages(child, nextPrefix);
    }
    if (typeof child !== 'string') {
      throw new Error(`${nextPrefix} must be a string`);
    }
    return [[nextPrefix, child]];
  });
}

function collectPlaceholders(message) {
  return [...message.matchAll(/\{[a-zA-Z0-9_]+\}/g)]
    .map((match) => match[0])
    .sort((left, right) => left.localeCompare(right));
}

function formatList(items) {
  return items.length === 0 ? '-' : items.join('\n');
}

function assertSameList(title, leftLabel, left, rightLabel, right) {
  const onlyLeft = left.filter((item) => !right.includes(item));
  const onlyRight = right.filter((item) => !left.includes(item));
  if (onlyLeft.length === 0 && onlyRight.length === 0) {
    return;
  }

  throw new Error(
    `${title} mismatch\nOnly in ${leftLabel}:\n${formatList(onlyLeft)}\nOnly in ${rightLabel}:\n${formatList(onlyRight)}`
  );
}

const zhFiles = readLocaleFileNames('zh-CN');
const enFiles = readLocaleFileNames('en-US');
assertSameList('locale file', 'zh-CN', zhFiles, 'en-US', enFiles);

for (const fileName of zhFiles) {
  const zhMessages = new Map(collectMessages(readJson('zh-CN', fileName)));
  const enMessages = new Map(collectMessages(readJson('en-US', fileName)));
  const zhKeys = [...zhMessages.keys()].sort((left, right) => left.localeCompare(right));
  const enKeys = [...enMessages.keys()].sort((left, right) => left.localeCompare(right));
  assertSameList(`${fileName} key`, 'zh-CN', zhKeys, 'en-US', enKeys);

  for (const key of zhKeys) {
    const zhPlaceholders = collectPlaceholders(zhMessages.get(key) ?? '');
    const enPlaceholders = collectPlaceholders(enMessages.get(key) ?? '');
    assertSameList(`${fileName}:${key} placeholder`, 'zh-CN', zhPlaceholders, 'en-US', enPlaceholders);
  }
}

console.log(`[nextclaw-ui-i18n-check] OK: ${zhFiles.length} locale files are aligned.`);
