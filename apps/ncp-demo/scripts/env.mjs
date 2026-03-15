import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadNcpDemoEnv(rootDir) {
  const files = [
    'backend/.env.local',
    'backend/.env',
    '.env.local',
    '.env'
  ];
  const loaded = {};
  for (const relativePath of files) {
    const absolutePath = resolve(rootDir, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    const content = readFileSync(absolutePath, 'utf8');
    Object.assign(loaded, parseEnvContent(content));
  }
  return loaded;
}

function parseEnvContent(content) {
  const output = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalized = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
    const match = normalized.match(/^"?([A-Za-z_][A-Za-z0-9_.-]*)"?\s*[:=]\s*(.+)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    output[key] = value;
  }
  return output;
}
