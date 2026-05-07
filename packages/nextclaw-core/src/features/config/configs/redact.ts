import type { ConfigUiHint, ConfigUiHints } from "./schema.hints.js";
import { isSensitiveConfigPath } from "./schema.hints.js";

function matchHint(path: string, hints: ConfigUiHints): ConfigUiHint | undefined {
  const direct = hints[path];
  if (direct) {
    return direct;
  }
  const segments = path.split(".");
  for (const [hintKey, hint] of Object.entries(hints)) {
    if (!hintKey.includes("*")) {
      continue;
    }
    const hintSegments = hintKey.split(".");
    if (hintSegments.length !== segments.length) {
      continue;
    }
    let match = true;
    for (let i = 0; i < segments.length; i += 1) {
      if (hintSegments[i] !== "*" && hintSegments[i] !== segments[i]) {
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

function isSensitivePath(path: string, hints?: ConfigUiHints): boolean {
  if (hints) {
    const hint = matchHint(path, hints);
    if (hint?.sensitive !== undefined) {
      return Boolean(hint.sensitive);
    }
  }
  return isSensitiveConfigPath(path);
}

export function redactConfigObject<T>(value: T, hints?: ConfigUiHints, prefix = ""): T {
  if (Array.isArray(value)) {
    const nextPath = prefix ? `${prefix}[]` : "[]";
    return value.map((entry) => redactConfigObject(entry, hints, nextPath)) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const entries = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(entries)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (isSensitivePath(nextPath, hints)) {
      output[key] = val ? "***" : val;
      continue;
    }
    output[key] = redactConfigObject(val, hints, nextPath);
  }
  return output as T;
}
