import type { ConfigSetOptions } from "./types.js";

export function isIndexSegment(raw: string): boolean {
  return /^[0-9]+$/.test(raw);
}

export function parseConfigPath(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const parts: string[] = [];
  let current = "";
  let i = 0;

  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (ch === "\\") {
      const next = trimmed[i + 1];
      if (next) {
        current += next;
      }
      i += 2;
      continue;
    }
    if (ch === ".") {
      if (current) {
        parts.push(current);
      }
      current = "";
      i += 1;
      continue;
    }
    if (ch === "[") {
      if (current) {
        parts.push(current);
      }
      current = "";
      const close = trimmed.indexOf("]", i);
      if (close === -1) {
        throw new Error(`Invalid path (missing "]"): ${raw}`);
      }
      const inside = trimmed.slice(i + 1, close).trim();
      if (!inside) {
        throw new Error(`Invalid path (empty "[]"): ${raw}`);
      }
      parts.push(inside);
      i = close + 1;
      continue;
    }
    current += ch;
    i += 1;
  }

  if (current) {
    parts.push(current);
  }

  return parts.map((part) => part.trim()).filter(Boolean);
}

export function parseRequiredConfigPath(raw: string): string[] {
  const parsedPath = parseConfigPath(raw);
  if (parsedPath.length === 0) {
    throw new Error("Path is empty.");
  }
  return parsedPath;
}

export function parseConfigSetValue(raw: string, opts: ConfigSetOptions): unknown {
  const trimmed = raw.trim();
  if (opts.json) {
    return JSON.parse(trimmed);
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

export function getAtConfigPath(root: unknown, pathSegments: string[]): { found: boolean; value?: unknown } {
  let current: unknown = root;
  for (const segment of pathSegments) {
    if (!current || typeof current !== "object") {
      return { found: false };
    }

    if (Array.isArray(current)) {
      if (!isIndexSegment(segment)) {
        return { found: false };
      }
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index) || index < 0 || index >= current.length) {
        return { found: false };
      }
      current = current[index];
      continue;
    }

    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return { found: false };
    }
    current = record[segment];
  }

  return { found: true, value: current };
}

export function setAtConfigPath(root: Record<string, unknown>, pathSegments: string[], value: unknown): void {
  let current: unknown = root;

  for (let i = 0; i < pathSegments.length - 1; i += 1) {
    const segment = pathSegments[i];
    const next = pathSegments[i + 1];
    const nextIsIndex = Boolean(next && isIndexSegment(next));

    if (Array.isArray(current)) {
      current = getOrCreateArraySegment(current, segment, nextIsIndex, pathSegments.slice(0, i));
      continue;
    }

    current = getOrCreateObjectSegment(current, segment, nextIsIndex);
  }

  setConfigPathValue(current, pathSegments[pathSegments.length - 1], value, pathSegments.slice(0, -1));
}

function ensureWritableArrayIndex(current: unknown[], index: number, parentPath: string[]): void {
  if (!Number.isFinite(index) || index < 0) {
    throw new Error(`Invalid array index "${index}"`);
  }
  if (index <= current.length) {
    return;
  }
  const parentPathExpr = formatConfigPath(parentPath);
  const parentLabel = parentPathExpr ? `"${parentPathExpr}"` : "the root array";
  throw new Error(`Cannot set sparse array index ${index} under ${parentLabel}. Set indices in order.`);
}

function getOrCreateArraySegment(
  current: unknown[],
  segment: string,
  nextIsIndex: boolean,
  parentPath: string[]
): unknown {
  const index = parseArrayIndexSegment(segment);
  ensureWritableArrayIndex(current, index, parentPath);
  const existing = current[index];
  if (!existing || typeof existing !== "object") {
    current[index] = nextIsIndex ? [] : {};
  }
  return current[index];
}

function getOrCreateObjectSegment(current: unknown, segment: string, nextIsIndex: boolean): unknown {
  if (!current || typeof current !== "object") {
    throw new Error(`Cannot traverse into "${segment}" (not an object)`);
  }

  const record = current as Record<string, unknown>;
  const existing = record[segment];
  if (!existing || typeof existing !== "object") {
    record[segment] = nextIsIndex ? [] : {};
  }
  return record[segment];
}

function setConfigPathValue(current: unknown, last: string, value: unknown, parentPath: string[]): void {
  if (Array.isArray(current)) {
    const index = parseArrayIndexSegment(last);
    ensureWritableArrayIndex(current, index, parentPath);
    current[index] = value;
    return;
  }

  if (!current || typeof current !== "object") {
    throw new Error(`Cannot set "${last}" (parent is not an object)`);
  }

  (current as Record<string, unknown>)[last] = value;
}

function parseArrayIndexSegment(segment: string): number {
  if (!isIndexSegment(segment)) {
    throw new Error(`Expected numeric index for array segment "${segment}"`);
  }
  return Number.parseInt(segment, 10);
}

function formatConfigPath(pathSegments: string[]): string {
  let expr = "";
  for (const segment of pathSegments) {
    if (isIndexSegment(segment)) {
      expr += `[${segment}]`;
      continue;
    }
    expr += expr ? `.${segment}` : segment;
  }
  return expr;
}

export function unsetAtConfigPath(root: Record<string, unknown>, pathSegments: string[]): boolean {
  let current: unknown = root;

  for (let i = 0; i < pathSegments.length - 1; i += 1) {
    const segment = pathSegments[i];
    if (!current || typeof current !== "object") {
      return false;
    }

    if (Array.isArray(current)) {
      if (!isIndexSegment(segment)) {
        return false;
      }
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index) || index < 0 || index >= current.length) {
        return false;
      }
      current = current[index];
      continue;
    }

    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return false;
    }
    current = record[segment];
  }

  const last = pathSegments[pathSegments.length - 1];
  if (Array.isArray(current)) {
    if (!isIndexSegment(last)) {
      return false;
    }
    const index = Number.parseInt(last, 10);
    if (!Number.isFinite(index) || index < 0 || index >= current.length) {
      return false;
    }
    current.splice(index, 1);
    return true;
  }

  if (!current || typeof current !== "object") {
    return false;
  }

  const record = current as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, last)) {
    return false;
  }
  delete record[last];
  return true;
}
