import type { ConfigUiHints, ConfigUiHint } from '@/api/types';

function normalizePath(path: string | Array<string | number>): string {
  if (Array.isArray(path)) {
    return path.filter((segment) => typeof segment === 'string').join('.');
  }
  return path;
}

export function hintForPath(
  path: string | Array<string | number>,
  hints?: ConfigUiHints
): ConfigUiHint | undefined {
  if (!hints) {
    return undefined;
  }
  const key = normalizePath(path);
  const direct = hints[key];
  if (direct) {
    return direct;
  }
  const segments = key.split('.');
  for (const [hintKey, hint] of Object.entries(hints)) {
    if (!hintKey.includes('*')) {
      continue;
    }
    const hintSegments = hintKey.split('.');
    if (hintSegments.length !== segments.length) {
      continue;
    }
    let match = true;
    for (let i = 0; i < segments.length; i += 1) {
      if (hintSegments[i] !== '*' && hintSegments[i] !== segments[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return hint;
    }
  }
  return undefined;
}
