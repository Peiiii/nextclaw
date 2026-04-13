#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import net from "node:net";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_UI_PORT = 18834;
const DEFAULT_FRONTEND_PORT = 5174;
const CONFIG_SOURCE_ENV = "NEXTCLAW_LOCAL_PLUGIN_SOURCE_CONFIG";
const READY_SERVICE_LOG = "✓ UI NCP agent: ready";
const READY_FRONTEND_LOG = "Local:";
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error(`[local-plugin-dev] ${message}`);
  process.exit(1);
}

function logWhenEnabled(jsonOutput, message) {
  if (!jsonOutput) {
    console.log(message);
  }
}

function printHelp() {
  console.log(`Usage: pnpm dev:plugin:local -- --plugin-path <path> [options]

Options:
  --plugin-path <path>     Local plugin directory in this repo or on disk.
  --plugin-id <id>         Plugin id override. Defaults to openclaw.plugin.json id.
  --source-config <path>   Config copied into the temporary NEXTCLAW_HOME.
                           Defaults to $${CONFIG_SOURCE_ENV} or ~/.nextclaw/config.json
  --ui-port <port>         Local backend/UI port. Defaults to the first free port starting from ${DEFAULT_UI_PORT}.
  --frontend               Also start packages/nextclaw-ui dev server and proxy it to the local backend.
  --frontend-port <port>   Frontend dev server port. Defaults to the first free port starting from ${DEFAULT_FRONTEND_PORT}.
  --session-type <type>    Optional readiness gate for agent-runtime plugins such as codex or claude.
  --timeout-ms <ms>        Startup timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --no-keep-running        Stop the started processes after readiness is confirmed.
  --json                   Print a machine-readable summary.
  --help                   Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    pluginPath: "",
    pluginId: "",
    sourceConfig: process.env[CONFIG_SOURCE_ENV] ?? "",
    uiPort: "",
    frontend: false,
    frontendPort: "",
    sessionType: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    keepRunning: true,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--") {
      continue;
    }
    switch (arg) {
      case "--plugin-path":
        options.pluginPath = next ?? "";
        index += 1;
        break;
      case "--plugin-id":
        options.pluginId = next ?? "";
        index += 1;
        break;
      case "--source-config":
        options.sourceConfig = next ?? "";
        index += 1;
        break;
      case "--ui-port":
        options.uiPort = next ?? "";
        index += 1;
        break;
      case "--frontend":
        options.frontend = true;
        break;
      case "--frontend-port":
        options.frontendPort = next ?? "";
        index += 1;
        break;
      case "--session-type":
        options.sessionType = next ?? "";
        index += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = Number.parseInt(next ?? "", 10);
        index += 1;
        break;
      case "--no-keep-running":
        options.keepRunning = false;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  if (!options.pluginPath.trim()) {
    fail("--plugin-path is required");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 5_000) {
    fail("--timeout-ms must be a number >= 5000");
  }
  return options;
}

function resolveSourceConfigPath(rawPath) {
  return rawPath.trim() ? path.resolve(rawPath) : path.join(homedir(), ".nextclaw", "config.json");
}

function ensureFileExists(filePath, label) {
  if (!existsSync(filePath)) {
    fail(`${label} not found: ${filePath}`);
  }
}

const readJsonFile = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

function resolvePluginMetadata(pluginPath, pluginIdOverride) {
  const packageJsonPath = path.join(pluginPath, "package.json"), pluginManifestPath = path.join(pluginPath, "openclaw.plugin.json");
  ensureFileExists(packageJsonPath, "Plugin package.json");
  ensureFileExists(pluginManifestPath, "Plugin manifest");

  const pkg = readJsonFile(packageJsonPath);
  const pluginManifest = readJsonFile(pluginManifestPath);
  const packageName = typeof pkg?.name === "string" && pkg.name.trim() ? pkg.name.trim() : null;
  const pluginId =
    pluginIdOverride.trim() ||
    (typeof pluginManifest?.id === "string" && pluginManifest.id.trim()) ||
    "";
  if (!pluginId) {
    fail(`Could not determine plugin id for ${pluginPath}. Pass --plugin-id explicitly.`);
  }

  const developmentExtensions = pkg?.openclaw?.development?.extensions;
  const hasDevelopmentSource =
    Array.isArray(developmentExtensions) &&
    developmentExtensions.some((entry) => typeof entry === "string" && entry.trim());
  return { pluginId, packageName, sourceMode: hasDevelopmentSource ? "development" : "production" };
}

function prepareLocalHome(sourceConfigPath) {
  ensureFileExists(sourceConfigPath, "Source config. Create ~/.nextclaw/config.json first or pass --source-config");
  const homeDir = path.join(tmpdir(), `nextclaw-local-plugin-dev-${Date.now().toString(36)}`);
  mkdirSync(homeDir, { recursive: true });
  copyFileSync(sourceConfigPath, path.join(homeDir, "config.json"));
  return homeDir;
}

function runCommand(args, env, label) {
  const result = spawnSync(pnpmCommand, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status === 0) {
    return;
  }
  const output = [result.stdout, result.stderr]
    .filter((chunk) => typeof chunk === "string" && chunk.trim())
    .join("\n")
    .trim();
  throw new Error(`${label} failed.\n${output}`);
}

function configurePlugin({ env, pluginPath, pluginId, sourceMode, jsonOutput }) {
  if (!jsonOutput) {
    console.log(`[local-plugin-dev] linking ${pluginId} from ${pluginPath}...`);
  }
  runCommand(
    ["-C", "packages/nextclaw", "dev:build", "plugins", "install", pluginPath, "--link"],
    env,
    "Link local plugin",
  );
  runCommand(
    ["-C", "packages/nextclaw", "dev:build", "config", "set", `plugins.entries.${pluginId}.source`, sourceMode],
    env,
    `Set plugin source=${sourceMode}`,
  );
}

function listenOnce(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not determine port."));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function findAvailablePort(startPort, defaultPort) {
  const candidate = Number.parseInt(String(startPort), 10);
  if (Number.isFinite(candidate) && candidate > 0) {
    return listenOnce(candidate).catch(() => findAvailablePort(candidate + 1, defaultPort));
  }
  return listenOnce(defaultPort).catch(() => findAvailablePort(defaultPort + 1, defaultPort));
}

function readSessionTypeOptions(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.data?.options)) {
    return payload.data.options;
  }
  return [];
}

async function waitForUrl(url, timeoutMs, sessionType = "") {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const healthResponse = await fetch(`${url}/api/health`);
      if (!healthResponse.ok) {
        throw new Error(`health status ${healthResponse.status}`);
      }
      if (!sessionType.trim()) {
        return;
      }

      const sessionTypesResponse = await fetch(`${url}/api/ncp/session-types`);
      if (!sessionTypesResponse.ok) {
        throw new Error(`session-types status ${sessionTypesResponse.status}`);
      }
      const items = readSessionTypeOptions(await sessionTypesResponse.json());
      const ready = items.some((entry) => {
        if (!entry || typeof entry !== "object") {
          return false;
        }
        return entry.id === sessionType || entry.sessionType === sessionType || entry.value === sessionType;
      });
      if (ready) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error(
    sessionType.trim()
      ? `Timed out waiting for session type "${sessionType}" on ${url}.`
      : `Timed out waiting for healthy service at ${url}.`,
  );
}

function startDetachedProcess({ command, args, env, logPath }) {
  const logFd = openSync(logPath, "a");
  const processHandle = spawn(command, args, {
    cwd: repoRoot,
    env,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  processHandle.unref();
  closeSync(logFd);
  return processHandle;
}

function killDetachedProcess(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return;
  }
  try {
    if (process.platform !== "win32") {
      process.kill(-pid, "SIGTERM");
      return;
    }
    process.kill(pid, "SIGTERM");
  } catch {
    // ignore cleanup failures
  }
}

function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLogTail(logPath, maxLines = 40) {
  try {
    const content = readFileSync(logPath, "utf8");
    return content.trim().split(/\r?\n/).slice(-maxLines).join("\n").trim();
  } catch {
    return "";
  }
}

async function waitForProcessLogReady({ pid, logPath, timeoutMs, label, readyLogText }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const logContent = readLogTail(logPath, 400);
    if (readyLogText.every((entry) => logContent.includes(entry))) {
      if (!isProcessAlive(pid)) {
        throw new Error(`${label} exited before staying ready.\n${readLogTail(logPath)}`);
      }
      return;
    }
    if (!isProcessAlive(pid)) {
      throw new Error(`${label} exited before readiness was confirmed.\n${readLogTail(logPath)}`);
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${label} readiness.\n${readLogTail(logPath)}`);
}

async function waitForHttpOk(url, timeoutMs, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${label} at ${url}.`);
}

async function startReadyProcess({
  command,
  args,
  env,
  logPath,
  timeoutMs,
  label,
  readyLogText,
  healthUrl,
  httpUrl,
  sessionType,
}) {
  const processHandle = startDetachedProcess({ command, args, env, logPath });
  await waitForProcessLogReady({
    pid: processHandle.pid,
    logPath,
    timeoutMs,
    label,
    readyLogText,
  });
  if (healthUrl) {
    await waitForUrl(healthUrl, timeoutMs, sessionType ?? "");
  }
  if (httpUrl) {
    await waitForHttpOk(httpUrl, timeoutMs, label);
  }
  return processHandle.pid;
}

async function startFrontendDevServer({
  enabled,
  frontendPort: preferredFrontendPort,
  homeDir,
  jsonOutput,
  baseUrl,
  timeoutMs,
}) {
  if (!enabled) {
    return { frontendPid: null, frontendPort: null, frontendUrl: null, frontendLogPath: null };
  }
  const frontendPort = await findAvailablePort(preferredFrontendPort || DEFAULT_FRONTEND_PORT, DEFAULT_FRONTEND_PORT);
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  const frontendLogPath = path.join(homeDir, "local-plugin-dev-frontend.log");
  logWhenEnabled(jsonOutput, `[local-plugin-dev] starting frontend dev server at ${frontendUrl}...`);
  const frontendPid = await startReadyProcess({
    label: "frontend dev server",
    command: pnpmCommand,
    args: ["-C", "packages/nextclaw-ui", "dev", "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
    env: { ...process.env, VITE_DEV_PROXY_API_BASE: baseUrl },
    logPath: frontendLogPath,
    timeoutMs,
    readyLogText: [READY_FRONTEND_LOG],
    httpUrl: frontendUrl,
  });
  return { frontendPid, frontendPort, frontendUrl, frontendLogPath };
}

function maybeStopProcesses(keepRunning, servicePid, frontendPid) {
  if (keepRunning) {
    return;
  }
  killDetachedProcess(servicePid);
  if (frontendPid) killDetachedProcess(frontendPid);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pluginPath = path.resolve(options.pluginPath);
  ensureFileExists(pluginPath, "Plugin path");

  const sourceConfigPath = resolveSourceConfigPath(options.sourceConfig);
  const metadata = resolvePluginMetadata(pluginPath, options.pluginId);
  const homeDir = prepareLocalHome(sourceConfigPath);
  const env = { ...process.env, NEXTCLAW_HOME: homeDir };

  logWhenEnabled(options.json, `[local-plugin-dev] NEXTCLAW_HOME=${homeDir}`);
  configurePlugin({
    env,
    pluginPath,
    pluginId: metadata.pluginId,
    sourceMode: metadata.sourceMode,
    jsonOutput: options.json,
  });

  const uiPort = await findAvailablePort(options.uiPort || DEFAULT_UI_PORT, DEFAULT_UI_PORT);
  const baseUrl = `http://127.0.0.1:${uiPort}`;
  const serviceLogPath = path.join(homeDir, "local-plugin-dev-service.log");

  logWhenEnabled(options.json, `[local-plugin-dev] starting local service at ${baseUrl}...`);
  const servicePid = await startReadyProcess({
    label: "local service",
    command: pnpmCommand,
    args: ["-C", "packages/nextclaw", "dev:build", "serve", "--ui-port", String(uiPort)],
    env,
    logPath: serviceLogPath,
    timeoutMs: options.timeoutMs,
    readyLogText: [READY_SERVICE_LOG],
    healthUrl: baseUrl,
    sessionType: options.sessionType.trim(),
  });

  const { frontendPid, frontendPort, frontendUrl, frontendLogPath } = await startFrontendDevServer({
    enabled: options.frontend,
    baseUrl,
    frontendPort: options.frontendPort,
    homeDir,
    jsonOutput: options.json,
    timeoutMs: options.timeoutMs,
  });
  maybeStopProcesses(options.keepRunning, servicePid, frontendPid);

  const summary = { ok: true, pluginId: metadata.pluginId, packageName: metadata.packageName, pluginPath, sourceMode: metadata.sourceMode, sessionType: options.sessionType.trim() || null, homeDir, baseUrl, uiPort, frontendUrl, frontendPort, servicePid, frontendPid, sourceConfigPath, serviceLogPath, frontendLogPath, keepRunning: options.keepRunning };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`[local-plugin-dev] plugin "${metadata.pluginId}" is now running locally.`);
  console.log(`[local-plugin-dev] plugin source mode: ${metadata.sourceMode}`);
  console.log(`[local-plugin-dev] backend URL: ${baseUrl}`);
  console.log(`[local-plugin-dev] backend log: ${serviceLogPath}`);
  console.log(`[local-plugin-dev] backend cleanup: kill ${servicePid}`);
  if (frontendUrl && frontendPid && frontendLogPath) {
    console.log(`[local-plugin-dev] frontend URL: ${frontendUrl}`);
    console.log(`[local-plugin-dev] frontend log: ${frontendLogPath}`);
    console.log(`[local-plugin-dev] frontend cleanup: kill ${frontendPid}`);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
