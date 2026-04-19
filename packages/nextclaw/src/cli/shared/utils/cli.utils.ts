import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { isIP } from "node:net";
import type { Interface } from "node:readline";
import { fileURLToPath } from "node:url";
import {
  createExternalCommandEnv,
  getLogsPath,
  getPackageVersion as getCorePackageVersion,
  resolveLocalUiBaseUrl,
  type Config
} from "@nextclaw/core";

export function resolveUiConfig(config: Config, overrides?: Partial<Config["ui"]>): Config["ui"] {
  const base = config.ui ?? { enabled: false, host: "127.0.0.1", port: 55667, open: false };
  return { ...base, ...(overrides ?? {}) };
}

export function resolveUiApiBase(host: string, port: number): string {
  return resolveLocalUiBaseUrl({ host, port });
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

const PUBLIC_IP_CHECK_URLS = ["https://api.ipify.org", "https://ifconfig.me/ip"];

async function fetchPublicIpFrom(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/plain"
      }
    });
    if (!response.ok) {
      return null;
    }
    const text = (await response.text()).trim();
    return isIP(text) ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolvePublicIp(timeoutMs = 1500): Promise<string | null> {
  for (const endpoint of PUBLIC_IP_CHECK_URLS) {
    const candidate = await fetchPublicIpFrom(endpoint, timeoutMs);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

export function buildServeArgs(options: { uiPort: number }): string[] {
  const cliPath = fileURLToPath(new URL("../../app/index.js", import.meta.url));
  return [cliPath, "serve", "--ui-port", String(options.uiPort)];
}

export function resolveServiceLogPath(): string {
  return resolve(getLogsPath(), "service.log");
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return !isProcessRunning(pid);
}

function findNearestPackageManifest(
  startDir: string,
  expectedName?: string
): { rootDir: string; version?: string } | null {
  let current = resolve(startDir);
  while (current.length > 0) {
    const pkgPath = join(current, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const raw = readFileSync(pkgPath, "utf-8");
        const parsed = JSON.parse(raw) as { name?: string; version?: string };
        const matchesExpectedName = !expectedName || parsed.name === expectedName;
        if (matchesExpectedName) {
          return {
            rootDir: current,
            version: typeof parsed.version === "string" ? parsed.version : undefined
          };
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

export function resolveUiStaticDir(importMetaUrl = import.meta.url): string | null {
  if (process.env.NEXTCLAW_DISABLE_STATIC_UI === "1") {
    return null;
  }

  const envDir = process.env.NEXTCLAW_UI_STATIC_DIR;
  if (envDir) {
    return existsSync(join(envDir, "index.html")) ? envDir : null;
  }

  const cliDir = resolve(fileURLToPath(new URL(".", importMetaUrl)));
  const pkgRoot = findNearestPackageManifest(cliDir, "nextclaw")?.rootDir;
  if (!pkgRoot) {
    return null;
  }
  const bundledDir = join(pkgRoot, "ui-dist");
  return existsSync(join(bundledDir, "index.html")) ? bundledDir : null;
}

export function openBrowser(url: string): boolean {
  const platform = process.platform;
  let command: string;
  let args: string[];
  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }
  if (!findExecutableOnPath(command)) {
    return false;
  }
  try {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: true,
      env: createExternalCommandEnv(process.env)
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export type ExecutableLookupEnv = {
  [key: string]: string | undefined;
  PATH?: string;
  Path?: string;
  path?: string;
  PATHEXT?: string;
};

function normalizePathEntries(rawPath: string, platform: NodeJS.Platform): string[] {
  const delimiter = platform === "win32" ? ";" : ":";
  return rawPath.split(delimiter).map((entry) => entry.trim().replace(/^"+|"+$/g, "")).filter(Boolean);
}

function normalizeWindowsPathExt(rawPathExt: string | undefined): string[] {
  const source = (rawPathExt && rawPathExt.trim().length > 0) ? rawPathExt : ".COM;.EXE;.BAT;.CMD";
  const unique = new Set<string>();
  for (const ext of source.split(";")) {
    const trimmed = ext.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
    unique.add(normalized.toUpperCase());
  }
  return [...unique];
}

function hasFileExtension(binary: string): boolean {
  return binary.lastIndexOf(".") > Math.max(binary.lastIndexOf("/"), binary.lastIndexOf("\\"));
}

export function findExecutableOnPath(
  binary: string,
  env: ExecutableLookupEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string | null {
  const target = binary.trim();
  if (!target) {
    return null;
  }

  if (target.includes("/") || target.includes("\\")) {
    return existsSync(target) ? target : null;
  }

  const rawPath = env.PATH ?? env.Path ?? env.path ?? "";
  if (!rawPath.trim()) {
    return null;
  }

  const entries = normalizePathEntries(rawPath, platform);
  if (entries.length === 0) {
    return null;
  }

  for (const dir of entries) {
    const direct = join(dir, target);
    if (existsSync(direct)) {
      return direct;
    }

    if (platform !== "win32" || hasFileExtension(target)) {
      continue;
    }

    for (const ext of normalizeWindowsPathExt(env.PATHEXT)) {
      const withExt = join(dir, `${target}${ext}`);
      if (existsSync(withExt)) {
        return withExt;
      }
    }
  }

  return null;
}

export function getPackageVersion(): string {
  const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
  const packageVersion =
    findNearestPackageManifest(cliDir, "nextclaw")?.version ??
    findNearestPackageManifest(cliDir)?.version;
  return (
    packageVersion ??
    getCorePackageVersion()
  );
}

export function printAgentResponse(response: string): void {
  console.log("\n" + response + "\n");
}

export async function prompt(rl: Interface, question: string): Promise<string> {
  rl.setPrompt(question);
  rl.prompt();
  return new Promise((resolve) => {
    rl.once("line", (line) => resolve(line));
  });
}
