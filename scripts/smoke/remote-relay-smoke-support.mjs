import { spawnSync } from "node:child_process";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = resolve(rootDir, "workers/nextclaw-provider-gateway-api");
const workerConfig = resolve(workerDir, "wrangler.toml");
export const wranglerBin = resolve(
  workerDir,
  "node_modules/.bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler"
);

export const nextclawCli = resolve(rootDir, "packages/nextclaw/dist/cli/index.js");
const remoteAccessHostPattern = /^r-[a-z0-9-]+\.claw\.cool$/i;
const remoteAccessFixedHost = "remote.claw.cool";

export function runOrThrow(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: rootDir,
    encoding: "utf-8",
    stdio: "pipe",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${cmd} ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
  return result;
}

export function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate free port."));
        return;
      }
      const port = address.port;
      server.close(() => resolvePort(port));
    });
    server.on("error", reject);
  });
}

export async function waitFor(check, timeoutMs, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 300));
  }
  throw new Error(`Timeout while waiting for ${label}.`);
}

export async function waitForHealth(url, timeoutMs = 30_000) {
  await waitFor(async () => {
    try {
      const response = await fetch(url);
      return response.ok ? true : false;
    } catch {
      return false;
    }
  }, timeoutMs, `health check ${url}`);
}

export async function fetchWithRetry(url, init, label, timeoutMs = 10_000) {
  return await waitFor(async () => {
    try {
      return await fetch(url, init);
    } catch {
      return false;
    }
  }, timeoutMs, label);
}

export async function requestJson({
  method,
  url,
  token,
  body,
  expectedStatus,
  headers = {}
}) {
  const finalHeaders = new Headers(headers);
  if (!finalHeaders.has("Content-Type") && body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetchWithRetry(url, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual"
  }, `request ${method} ${url}`);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (typeof expectedStatus === "number" && response.status !== expectedStatus) {
    throw new Error(
      `Unexpected status for ${method} ${url}: expected ${expectedStatus}, got ${response.status}, body=${text}`
    );
  }
  return { status: response.status, body: parsed, headers: response.headers };
}

export function extractCookie(setCookieHeader) {
  if (typeof setCookieHeader !== "string" || setCookieHeader.trim().length === 0) {
    throw new Error("Missing Set-Cookie header.");
  }
  const firstSegment = setCookieHeader.split(";")[0]?.trim();
  if (!firstSegment) {
    throw new Error(`Invalid Set-Cookie header: ${setCookieHeader}`);
  }
  return firstSegment;
}

export function assertRemoteOpenUrlShape(url, label) {
  const parsed = new URL(url);
  if (!remoteAccessHostPattern.test(parsed.hostname)) {
    throw new Error(`${label} must use instance subdomain under claw.cool, got ${url}`);
  }
  if (parsed.pathname !== "/platform/remote/open") {
    throw new Error(`${label} must target /platform/remote/open, got ${url}`);
  }
  if (parsed.searchParams.get("token")?.trim() !== parsed.searchParams.get("token")) {
    throw new Error(`${label} token query is malformed, got ${url}`);
  }
  if (!parsed.searchParams.get("token")) {
    throw new Error(`${label} must include token query, got ${url}`);
  }
  return parsed;
}

export function assertFixedDomainOpenUrlShape(url, label) {
  const parsed = new URL(url);
  if (parsed.hostname !== remoteAccessFixedHost) {
    throw new Error(`${label} must use fixed remote host ${remoteAccessFixedHost}, got ${url}`);
  }
  if (parsed.pathname !== "/platform/remote/open") {
    throw new Error(`${label} must target /platform/remote/open, got ${url}`);
  }
  if (!parsed.searchParams.get("token")) {
    throw new Error(`${label} must include token query, got ${url}`);
  }
  return parsed;
}

function parseD1Results(stdout) {
  const parsed = JSON.parse(stdout);
  if (Array.isArray(parsed)) {
    const first = parsed[0];
    if (Array.isArray(first?.results)) {
      return first.results;
    }
  }
  if (Array.isArray(parsed?.results)) {
    return parsed.results;
  }
  throw new Error(`Unexpected D1 JSON output: ${stdout}`);
}

export function queryLocalD1({ persistDir, sql }) {
  const result = runOrThrow(wranglerBin, [
    "d1",
    "execute",
    "NEXTCLAW_PLATFORM_DB",
    "--local",
    "--config",
    workerConfig,
    "--persist-to",
    persistDir,
    "--json",
    "--command",
    sql
  ]);
  return parseD1Results(result.stdout);
}
