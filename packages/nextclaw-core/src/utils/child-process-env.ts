import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";

const DEVELOPMENT_CONDITION_PATTERN = /(^|\s)--conditions(?:=|\s+)development(?=\s|$)/g;
const COMMON_POSIX_BIN_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/opt/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

function splitPathEntries(rawPath: string): string[] {
  return rawPath
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function collectNodeModulesBinDirs(cwd: string): string[] {
  const entries: string[] = [];
  let current = resolve(cwd);

  while (current.length > 0) {
    const candidate = join(current, "node_modules", ".bin");
    if (existsSync(candidate)) {
      entries.push(candidate);
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return entries;
}

function collectExternalCommandPathAdditions(cwd: string): string[] {
  const additions = [dirname(process.execPath), ...collectNodeModulesBinDirs(cwd)];
  if (process.platform !== "win32") {
    additions.push(...COMMON_POSIX_BIN_DIRS);
  }
  return additions.filter((entry) => entry.trim().length > 0 && existsSync(entry));
}

function resolvePathKey(env: NodeJS.ProcessEnv): "PATH" | "Path" | "path" {
  if (typeof env.PATH === "string") {
    return "PATH";
  }
  if (typeof env.Path === "string") {
    return "Path";
  }
  if (typeof env.path === "string") {
    return "path";
  }
  return "PATH";
}

function buildExternalCommandPathValue(env: NodeJS.ProcessEnv, cwd: string): string | undefined {
  const pathKey = resolvePathKey(env);
  const existingEntries = splitPathEntries(env[pathKey] ?? "");
  const additions = collectExternalCommandPathAdditions(cwd);
  const mergedEntries = Array.from(new Set([...existingEntries, ...additions]));
  return mergedEntries.length > 0 ? mergedEntries.join(delimiter) : undefined;
}

export function sanitizeNodeOptionsForExternalCommand(nodeOptions?: string): string | undefined {
  if (typeof nodeOptions !== "string") {
    return undefined;
  }
  const sanitized = nodeOptions
    .replace(DEVELOPMENT_CONDITION_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || undefined;
}

export function createExternalCommandEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  extraEnv: NodeJS.ProcessEnv = {},
  options: {
    cwd?: string;
  } = {},
): NodeJS.ProcessEnv {
  const env = { ...baseEnv, ...extraEnv };
  const sanitizedNodeOptions = sanitizeNodeOptionsForExternalCommand(env.NODE_OPTIONS);
  if (sanitizedNodeOptions) {
    env.NODE_OPTIONS = sanitizedNodeOptions;
  } else {
    delete env.NODE_OPTIONS;
  }
  const pathKey = resolvePathKey(env);
  const nextPath = buildExternalCommandPathValue(env, options.cwd ?? process.cwd());
  if (nextPath) {
    env[pathKey] = nextPath;
  } else {
    delete env[pathKey];
  }
  return env;
}
