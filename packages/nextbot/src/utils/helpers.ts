import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export function ensureDir(path: string): string {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
  return path;
}

export function getDataPath(): string {
  const override = process.env.NEXTBOT_HOME?.trim();
  if (override) {
    return ensureDir(resolve(override));
  }
  const defaultPath = resolve(homedir(), ".nextbot");
  if (existsSync(defaultPath)) {
    return ensureDir(defaultPath);
  }
  const legacyPath = resolve(homedir(), ".nanobot");
  if (existsSync(legacyPath)) {
    return ensureDir(legacyPath);
  }
  return ensureDir(defaultPath);
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
