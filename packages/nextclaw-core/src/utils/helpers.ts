import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_HOME_DIR, ENV_HOME_KEY } from "../config/brand.js";

export function ensureDir(path: string): string {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
  return path;
}

export function getDataPath(): string {
  const override = process.env[ENV_HOME_KEY]?.trim();
  if (override) {
    return ensureDir(resolve(override));
  }
  return ensureDir(resolve(homedir(), DEFAULT_HOME_DIR));
}

export function getWorkspacePath(workspace?: string): string {
  if (workspace) {
    return ensureDir(resolve(expandHome(workspace)));
  }
  return ensureDir(resolve(getDataPath(), "workspace"));
}

export function getSessionsPath(): string {
  return ensureDir(resolve(getDataPath(), "sessions"));
}

export function getMemoryPath(workspace?: string): string {
  return ensureDir(resolve(workspace ? expandHome(workspace) : getWorkspacePath(), "memory"));
}

export function getSkillsPath(workspace?: string): string {
  return ensureDir(resolve(workspace ? expandHome(workspace) : getWorkspacePath(), "skills"));
}

export function todayDate(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function truncateString(value: string, maxLen = 100, suffix = "..."): string {
  if (value.length <= maxLen) {
    return value;
  }
  return value.slice(0, maxLen - suffix.length) + suffix;
}

export function safeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export function parseSessionKey(key: string): { channel: string; chatId: string } {
  const [channel, chatId] = key.split(":", 2);
  if (!channel || !chatId) {
    throw new Error(`Invalid session key: ${key}`);
  }
  return { channel, chatId };
}

export function expandHome(value: string): string {
  if (value.startsWith("~/")) {
    return resolve(homedir(), value.slice(2));
  }
  return value;
}

function resolveVersionFromPackageTree(startDir: string, expectedName?: string): string | null {
  let current = resolve(startDir);
  while (current.length > 0) {
    const pkgPath = resolve(current, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const raw = readFileSync(pkgPath, "utf-8");
        const parsed = JSON.parse(raw) as { name?: string; version?: string };
        if (typeof parsed.version === "string") {
          if (!expectedName || parsed.name === expectedName) {
            return parsed.version;
          }
        }
      } catch {
        // Ignore malformed package.json and continue searching upwards.
      }
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

export function getPackageVersion(): string {
  const dir = resolve(fileURLToPath(new URL(".", import.meta.url)));
  return (
    resolveVersionFromPackageTree(dir, "@nextclaw/core") ??
    resolveVersionFromPackageTree(dir) ??
    "0.0.0"
  );
}
