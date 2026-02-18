import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { isIP } from "node:net";
import type { Interface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { Config } from "@nextclaw/core";
import { getDataDir, getPackageVersion as getCorePackageVersion } from "@nextclaw/core";

export type ServiceState = {
  pid: number;
  startedAt: string;
  uiUrl: string;
  apiUrl: string;
  uiHost?: string;
  uiPort?: number;
  logPath: string;
};

export function resolveUiConfig(config: Config, overrides?: Partial<Config["ui"]>): Config["ui"] {
  const base = config.ui ?? { enabled: false, host: "127.0.0.1", port: 18791, open: false };
  return { ...base, ...(overrides ?? {}) };
}

export function resolveUiApiBase(host: string, port: number): string {
  const normalizedHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return `http://${normalizedHost}:${port}`;
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

export function buildServeArgs(options: { uiHost: string; uiPort: number }): string[] {
  const cliPath = fileURLToPath(new URL("./index.js", import.meta.url));
  return [cliPath, "serve", "--ui-host", options.uiHost, "--ui-port", String(options.uiPort)];
}

export function readServiceState(): ServiceState | null {
  const path = resolveServiceStatePath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as ServiceState;
  } catch {
    return null;
  }
}

export function writeServiceState(state: ServiceState): void {
  const path = resolveServiceStatePath();
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

export function clearServiceState(): void {
  const path = resolveServiceStatePath();
  if (existsSync(path)) {
    rmSync(path, { force: true });
  }
}

export function resolveServiceStatePath(): string {
  return resolve(getDataDir(), "run", "service.json");
}

export function resolveServiceLogPath(): string {
  return resolve(getDataDir(), "logs", "service.log");
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

export function resolveUiStaticDir(): string | null {
  const candidates: string[] = [];
  const envDir = process.env.NEXTCLAW_UI_STATIC_DIR;
  if (envDir) {
    candidates.push(envDir);
  }

  const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
  const pkgRoot = resolve(cliDir, "..", "..");
  candidates.push(join(pkgRoot, "ui-dist"));
  candidates.push(join(pkgRoot, "ui"));
  candidates.push(join(pkgRoot, "..", "ui-dist"));
  candidates.push(join(pkgRoot, "..", "ui"));

  const cwd = process.cwd();
  candidates.push(join(cwd, "packages", "nextclaw-ui", "dist"));
  candidates.push(join(cwd, "nextclaw-ui", "dist"));
  candidates.push(join(pkgRoot, "..", "nextclaw-ui", "dist"));
  candidates.push(join(pkgRoot, "..", "..", "packages", "nextclaw-ui", "dist"));
  candidates.push(join(pkgRoot, "..", "..", "nextclaw-ui", "dist"));

  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) {
      return dir;
    }
  }
  return null;
}

export function openBrowser(url: string): void {
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
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}

export function which(binary: string): boolean {
  const paths = (process.env.PATH ?? "").split(":");
  for (const dir of paths) {
    const full = join(dir, binary);
    if (existsSync(full)) {
      return true;
    }
  }
  return false;
}

function resolveVersionFromPackageTree(startDir: string, expectedName?: string): string | null {
  let current = resolve(startDir);
  while (current.length > 0) {
    const pkgPath = join(current, "package.json");
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
  const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
  return (
    resolveVersionFromPackageTree(cliDir, "nextclaw") ??
    resolveVersionFromPackageTree(cliDir) ??
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
