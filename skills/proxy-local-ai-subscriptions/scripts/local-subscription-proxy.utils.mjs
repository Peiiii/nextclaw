import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function parseOptions(argv, { values = [], booleans = [] } = {}) {
  const valueNames = new Set(values);
  const booleanNames = new Set(booleans);
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const name = argument.slice(2);
    if (Object.prototype.hasOwnProperty.call(options, name)) {
      throw new Error(`Duplicate option: --${name}`);
    }
    if (booleanNames.has(name)) {
      options[name] = true;
      continue;
    }
    if (!valueNames.has(name)) {
      throw new Error(`Unknown option: --${name}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`--${name} requires a value`);
    }
    options[name] = value.trim();
    index += 1;
  }

  return options;
}

export function requireOption(options, name) {
  const value = options[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`--${name} is required`);
  }
  return value.trim();
}

function normalizeLocalUrl(rawUrl, label) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error(`${label} must use http or https`);
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`${label} must resolve to localhost; received ${url.hostname}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must not contain credentials, query parameters, or fragments`);
  }
  return url;
}

export function normalizeOpenAiEndpoint(rawUrl) {
  const url = normalizeLocalUrl(rawUrl, "--endpoint");
  const path = url.pathname.replace(/\/+$/, "");
  if (path && path !== "/v1") {
    throw new Error("--endpoint path must be /v1 or empty");
  }
  url.pathname = "/v1";
  return url.toString().replace(/\/$/, "");
}

export function normalizeNextclawApi(rawUrl) {
  const url = normalizeLocalUrl(rawUrl, "--nextclaw-api");
  const path = url.pathname.replace(/\/+$/, "");
  if (path && path !== "/api") {
    throw new Error("--nextclaw-api path must be /api or empty");
  }
  url.pathname = "/api";
  return url.toString().replace(/\/$/, "");
}

export function discoverNextclawApi(command = "nextclaw") {
  const result = spawnSync(command, ["status", "--json"], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Unable to execute ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} status --json failed: ${(result.stderr || result.stdout).trim()}`);
  }
  let status;
  try {
    status = JSON.parse(result.stdout);
  } catch {
    throw new Error(`${command} status --json returned invalid JSON`);
  }
  const apiUrl = status?.endpoints?.apiUrl;
  if (typeof apiUrl !== "string" || !apiUrl.trim()) {
    throw new Error(`${command} status --json did not report endpoints.apiUrl`);
  }
  return normalizeNextclawApi(apiUrl);
}

export function readApiKey(filePath) {
  const stats = statSync(filePath, { throwIfNoEntry: false });
  if (!stats?.isFile()) {
    throw new Error(`API key file is missing or not a regular file: ${filePath}`);
  }
  if (stats.size > 4096) {
    throw new Error(`API key file is unexpectedly large: ${filePath}`);
  }
  const apiKey = readFileSync(filePath, "utf8").trim();
  if (!apiKey) {
    throw new Error(`API key file is empty: ${filePath}`);
  }
  return apiKey;
}

export async function requestJson(url, { method = "GET", apiKey, body, timeoutMs = 30_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${response.status} returned invalid JSON`);
      }
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || text.trim() || response.statusText;
      throw new Error(`HTTP ${response.status}: ${String(message).slice(0, 500)}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractModelIds(payload) {
  const entries = Array.isArray(payload?.data) ? payload.data : [];
  return [...new Set(entries
    .map((entry) => typeof entry?.id === "string" ? entry.id.trim() : "")
    .filter(Boolean))];
}

export function unwrapNextclaw(payload, label) {
  if (payload?.ok === true) {
    return payload.data;
  }
  const message = payload?.error?.message || `${label} returned an invalid response`;
  throw new Error(`${label} failed: ${message}`);
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`);
  process.exitCode = 1;
}
