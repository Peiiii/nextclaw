#!/usr/bin/env node

import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  extractModelIds,
  fail,
  normalizeOpenAiEndpoint,
  parseOptions,
  printJson,
  readApiKey,
  requestJson,
  requireOption,
} from "./local-subscription-proxy.utils.mjs";

const MANAGED_MARKER = "# Managed by NextClaw skill: proxy-local-ai-subscriptions";
const AUDITED_VERSION = "7.2.90";

function help() {
  process.stdout.write(`Usage:
  node scripts/cliproxy.mjs write-config --config <path> --auth-dir <path> [--api-key-file <path>] [--port 8317] [--force]
  node scripts/cliproxy.mjs check --config <path> --endpoint <url> --api-key-file <path> [--binary cliproxyapi] [--allow-unaudited-version]
  node scripts/cliproxy.mjs smoke --endpoint <url> --api-key-file <path> --model <id> [--wire responses|chat] [--prompt <text>] [--expect <text>]
`);
}

function yamlString(value) {
  return JSON.stringify(value);
}

function parsePort(rawPort) {
  const port = Number.parseInt(rawPort || "8317", 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("--port must be an integer between 1024 and 65535");
  }
  return port;
}

function ensureRegularTarget(filePath, label) {
  if (!existsSync(filePath)) return;
  const stats = lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file: ${filePath}`);
  }
}

function atomicWrite(filePath, content, mode) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  try {
    writeFileSync(tempPath, content, { encoding: "utf8", flag: "wx", mode });
    renameSync(tempPath, filePath);
    chmodSync(filePath, mode);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
}

function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.backup-${timestamp}`;
  copyFileSync(filePath, backupPath);
  chmodSync(backupPath, 0o600);
  return backupPath;
}

function isFactoryTemplate(source) {
  return source.includes('host: ""') && source.includes('"your-api-key-1"');
}

function buildConfig({ apiKey, authDir, port }) {
  return `${MANAGED_MARKER}
host: "127.0.0.1"
port: ${port}
tls:
  enable: false
  cert: ""
  key: ""
remote-management:
  allow-remote: false
  secret-key: ""
  disable-control-panel: true
auth-dir: ${yamlString(authDir)}
api-keys:
  - ${yamlString(apiKey)}
debug: false
pprof:
  enable: false
  addr: "127.0.0.1:8316"
plugins:
  enabled: false
usage-statistics-enabled: false
logging-to-file: true
logs-max-total-size-mb: 50
`;
}

function writeConfig(argv) {
  const options = parseOptions(argv, {
    values: ["config", "auth-dir", "api-key-file", "port"],
    booleans: ["force"],
  });
  const configPath = resolve(requireOption(options, "config"));
  const authDir = resolve(requireOption(options, "auth-dir"));
  const apiKeyFile = resolve(options["api-key-file"] || join(authDir, "nextclaw-api-key"));
  const port = parsePort(options.port);
  ensureRegularTarget(configPath, "Config path");
  ensureRegularTarget(apiKeyFile, "API key path");

  const currentSource = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const currentIsManaged = currentSource.startsWith(MANAGED_MARKER);
  const canReplace = !currentSource || currentIsManaged || isFactoryTemplate(currentSource) || options.force === true;
  if (!canReplace) {
    throw new Error(`Refusing to overwrite an existing unmanaged config without --force: ${configPath}`);
  }
  if (currentIsManaged && !existsSync(apiKeyFile)) {
    throw new Error(`Managed config exists but its API key file is missing: ${apiKeyFile}`);
  }

  mkdirSync(authDir, { recursive: true, mode: 0o700 });
  chmodSync(authDir, 0o700);
  if (!existsSync(apiKeyFile)) {
    const apiKey = `nc_local_${randomBytes(32).toString("base64url")}`;
    atomicWrite(apiKeyFile, `${apiKey}\n`, 0o600);
  } else {
    chmodSync(apiKeyFile, 0o600);
  }
  const apiKey = readApiKey(apiKeyFile);
  const nextSource = buildConfig({ apiKey, authDir, port });
  if (nextSource === currentSource) {
    printJson({
      ok: true,
      changed: false,
      configPath,
      authDir,
      apiKeyFile,
      endpoint: `http://127.0.0.1:${port}/v1`,
      backupPath: null,
    });
    return;
  }

  const backupPath = currentSource ? createBackup(configPath) : null;
  atomicWrite(configPath, nextSource, 0o600);
  printJson({
    ok: true,
    changed: true,
    configPath,
    authDir,
    apiKeyFile,
    endpoint: `http://127.0.0.1:${port}/v1`,
    backupPath,
  });
}

function inspectVersion(binary) {
  const result = spawnSync(binary, ["--help"], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Unable to execute ${binary}: ${result.error.message}`);
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const version = output.match(/CLIProxyAPI Version:\s*([^,\s]+)/i)?.[1] ?? null;
  if (!version) {
    throw new Error(`Unable to identify CLIProxyAPI version from ${binary} --help`);
  }
  return version.replace(/^v/, "");
}

function inspectConfigSafety(configPath) {
  ensureRegularTarget(configPath, "Config path");
  if (!existsSync(configPath)) {
    throw new Error(`Config file does not exist: ${configPath}`);
  }
  const source = readFileSync(configPath, "utf8");
  const checks = {
    localhostOnly: /^host:\s*["']?127\.0\.0\.1["']?\s*$/m.test(source),
    managementDisabled: /^\s*secret-key:\s*(?:["']{2})?\s*$/m.test(source),
    controlPanelDisabled: /^\s*disable-control-panel:\s*true\s*$/m.test(source),
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length > 0) {
    throw new Error(`Unsafe CLIProxyAPI config (${failed.join(", ")}): ${configPath}`);
  }
  return { ...checks, managed: source.startsWith(MANAGED_MARKER) };
}

async function check(argv) {
  const options = parseOptions(argv, {
    values: ["binary", "config", "endpoint", "api-key-file"],
    booleans: ["allow-unaudited-version"],
  });
  const binary = options.binary || "cliproxyapi";
  const configPath = resolve(requireOption(options, "config"));
  const endpoint = normalizeOpenAiEndpoint(requireOption(options, "endpoint"));
  const apiKeyFile = resolve(requireOption(options, "api-key-file"));
  const version = inspectVersion(binary);
  const auditedFamily = version.startsWith("7.2.");
  if (!auditedFamily && options["allow-unaudited-version"] !== true) {
    throw new Error(`CLIProxyAPI ${version} is outside the audited 7.2.x family; re-audit before continuing`);
  }
  const configSafety = inspectConfigSafety(configPath);
  const apiKey = readApiKey(apiKeyFile);
  const payload = await requestJson(`${endpoint}/models`, { apiKey });
  const models = extractModelIds(payload);
  if (models.length === 0) {
    throw new Error("CLIProxyAPI returned no models; complete OAuth login before continuing");
  }
  printJson({
    ok: true,
    binary,
    version,
    auditedVersion: AUDITED_VERSION,
    auditedFamily,
    configPath,
    configSafety,
    endpoint,
    apiKeyFile,
    modelCount: models.length,
    models,
  });
}

function extractResponseText(payload, wire) {
  if (wire === "chat") {
    return payload?.choices?.[0]?.message?.content;
  }
  if (typeof payload?.output_text === "string") return payload.output_text;
  const texts = Array.isArray(payload?.output)
    ? payload.output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .map((item) => typeof item?.text === "string" ? item.text : "")
      .filter(Boolean)
    : [];
  return texts.join("");
}

async function smoke(argv) {
  const options = parseOptions(argv, {
    values: ["endpoint", "api-key-file", "model", "wire", "prompt", "expect"],
  });
  const endpoint = normalizeOpenAiEndpoint(requireOption(options, "endpoint"));
  const apiKey = readApiKey(resolve(requireOption(options, "api-key-file")));
  const model = requireOption(options, "model");
  const wire = options.wire || "responses";
  if (!new Set(["responses", "chat"]).has(wire)) {
    throw new Error("--wire must be responses or chat");
  }
  const expected = options.expect || "NEXTCLAW_PROXY_OK";
  const prompt = options.prompt || `Reply exactly ${expected}`;
  const request = wire === "chat"
    ? {
        url: `${endpoint}/chat/completions`,
        body: { model, messages: [{ role: "user", content: prompt }], stream: false, max_tokens: 128 },
      }
    : {
        url: `${endpoint}/responses`,
        body: { model, input: prompt, stream: false, max_output_tokens: 128 },
      };
  const startedAt = Date.now();
  const payload = await requestJson(request.url, {
    method: "POST",
    apiKey,
    body: request.body,
    timeoutMs: 120_000,
  });
  const assistantText = extractResponseText(payload, wire)?.trim() || "";
  if (assistantText !== expected) {
    throw new Error(`Model reply did not exactly match the expected marker; received: ${assistantText || "(empty)"}`);
  }
  printJson({
    ok: true,
    endpoint,
    wire,
    model,
    expected,
    assistantText,
    latencyMs: Date.now() - startedAt,
  });
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    help();
    return;
  }
  if (command === "write-config") {
    writeConfig(argv);
    return;
  }
  if (command === "check") {
    await check(argv);
    return;
  }
  if (command === "smoke") {
    await smoke(argv);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch(fail);
