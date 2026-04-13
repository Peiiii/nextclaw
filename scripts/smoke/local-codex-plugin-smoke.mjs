#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
} from "node:fs";
import net from "node:net";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PROMPT = "Reply exactly NEXTCLAW_LOCAL_CODEX_PLUGIN_OK";
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_PORT = 18834;
const PLUGIN_ID = "nextclaw-ncp-runtime-plugin-codex-sdk";
const CONFIG_SOURCE_ENV = "NEXTCLAW_LOCAL_CODEX_PLUGIN_SOURCE_CONFIG";
const KEEP_RUNNING_DEFAULT = true;

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const pluginPath = path.join(
  repoRoot,
  "packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk",
);
const smokeScriptPath = path.join(repoRoot, "scripts/smoke/chat-capability-smoke.mjs");

function printHelp() {
  console.log(`Usage: pnpm smoke:codex-plugin:local -- [options]

Options:
  --model <id>             Model to verify. Defaults to agents.defaults.model from the source config.
  --prompt <text>          Smoke prompt (default: "${DEFAULT_PROMPT}")
  --ui-port <port>         Fixed local UI/API port. Defaults to the first free port starting from ${DEFAULT_PORT}.
  --source-config <path>   Config to copy into the temporary NEXTCLAW_HOME.
                           Defaults to $${CONFIG_SOURCE_ENV} or ~/.nextclaw/config.json
  --timeout-ms <ms>        Startup + smoke timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --no-keep-running        Stop the local service after the smoke finishes.
  --json                   Print a machine-readable summary after the smoke.
  --help                   Show this help.
`);
}

function fail(message) {
  console.error(`[local-codex-plugin-smoke] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    model: "",
    prompt: DEFAULT_PROMPT,
    uiPort: "",
    sourceConfig: process.env[CONFIG_SOURCE_ENV] ?? "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    keepRunning: KEEP_RUNNING_DEFAULT,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--model":
        options.model = next ?? "";
        index += 1;
        break;
      case "--prompt":
        options.prompt = next ?? "";
        index += 1;
        break;
      case "--ui-port":
        options.uiPort = next ?? "";
        index += 1;
        break;
      case "--source-config":
        options.sourceConfig = next ?? "";
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

  if (!options.prompt.trim()) {
    fail("--prompt is required");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 5_000) {
    fail("--timeout-ms must be a number >= 5000");
  }

  return options;
}

function resolveSourceConfigPath(rawPath) {
  if (rawPath.trim()) {
    return path.resolve(rawPath);
  }
  return path.join(homedir(), ".nextclaw", "config.json");
}

function readConfig(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function pickDefaultModel(config) {
  const pluginModel = config?.plugins?.entries?.[PLUGIN_ID]?.config?.model;
  if (typeof pluginModel === "string" && pluginModel.trim()) {
    return pluginModel.trim();
  }
  const defaultModel = config?.agents?.defaults?.model;
  return typeof defaultModel === "string" && defaultModel.trim()
    ? defaultModel.trim()
    : "";
}

function runCommand(args, env, label) {
  const result = spawnSync(pnpmCommand, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status === 0) {
    return result;
  }

  const output = [result.stdout, result.stderr]
    .filter((chunk) => typeof chunk === "string" && chunk.trim())
    .join("\n")
    .trim();

  throw new Error(`${label} failed.\n${output}`);
}

function findAvailablePort(startPort) {
  const candidate = Number.parseInt(String(startPort), 10);
  if (Number.isFinite(candidate) && candidate > 0) {
    return listenOnce(candidate).catch(() => findAvailablePort(candidate + 1));
  }
  return listenOnce(DEFAULT_PORT).catch(() => findAvailablePort(DEFAULT_PORT + 1));
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

async function waitForHealthyCodex(baseUrl, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      if (!healthResponse.ok) {
        throw new Error(`health status ${healthResponse.status}`);
      }

      const sessionTypesResponse = await fetch(`${baseUrl}/api/ncp/session-types`);
      if (!sessionTypesResponse.ok) {
        throw new Error(`session-types status ${sessionTypesResponse.status}`);
      }

      const payload = await sessionTypesResponse.json();
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.data?.options)
            ? payload.data.options
            : [];
      const hasCodex = items.some((entry) => {
        if (!entry || typeof entry !== "object") {
          return false;
        }
        return (
          entry.id === "codex" ||
          entry.sessionType === "codex" ||
          entry.value === "codex"
        );
      });

      if (hasCodex) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Timed out waiting for the local service to expose the codex session type.");
}

function tailFile(filePath, maxLines = 80) {
  if (!existsSync(filePath)) {
    return "";
  }
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/g);
  return lines.slice(Math.max(0, lines.length - maxLines)).join("\n").trim();
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
    // Ignore cleanup failures.
  }
}

function ensureSourceConfigExists(sourceConfigPath) {
  if (existsSync(sourceConfigPath)) {
    return;
  }
  fail(
    `Source config not found: ${sourceConfigPath}. ` +
      `Create ~/.nextclaw/config.json first or pass --source-config.`,
  );
}

function prepareLocalHome(options, sourceConfigPath) {
  if (!existsSync(pluginPath)) {
    fail(`Codex plugin path not found: ${pluginPath}`);
  }

  const sourceConfig = readConfig(sourceConfigPath);
  const selectedModel = options.model.trim() || pickDefaultModel(sourceConfig);
  const homeDir = path.join(
    tmpdir(),
    `nextclaw-codex-plugin-local-${Date.now().toString(36)}`,
  );
  mkdirSync(homeDir, { recursive: true });
  copyFileSync(sourceConfigPath, path.join(homeDir, "config.json"));

  const env = {
    ...process.env,
    NEXTCLAW_HOME: homeDir,
  };

  return {
    env,
    homeDir,
    selectedModel,
    sourceConfigPath,
  };
}

function configureLocalCodexDevelopmentPlugin(env, jsonOutput) {
  if (!jsonOutput) {
    console.log(`[local-codex-plugin-smoke] linking local Codex plugin...`);
  }

  runCommand(
    [
      "-C",
      "packages/nextclaw",
      "dev:build",
      "plugins",
      "install",
      pluginPath,
      "--link",
    ],
    env,
    "Link local Codex plugin",
  );

  runCommand(
    [
      "-C",
      "packages/nextclaw",
      "dev:build",
      "config",
      "set",
      `plugins.entries.${PLUGIN_ID}.source`,
      "development",
    ],
    env,
    "Set Codex plugin source=development",
  );
}

function startLocalService(env, port, jsonOutput) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const serviceLogPath = path.join(env.NEXTCLAW_HOME, "local-codex-plugin-service.log");
  const logFd = openSync(serviceLogPath, "a");

  if (!jsonOutput) {
    console.log(`[local-codex-plugin-smoke] starting local service at ${baseUrl}...`);
  }

  const serviceProcess = spawn(
    pnpmCommand,
    ["-C", "packages/nextclaw", "dev:build", "serve", "--ui-port", String(port)],
    {
      cwd: repoRoot,
      env,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    },
  );
  serviceProcess.unref();
  closeSync(logFd);

  return {
    baseUrl,
    serviceLogPath,
    serviceProcess,
  };
}

function runLocalCodexSmoke(params) {
  const smokeArgs = [
    smokeScriptPath,
    "--session-type",
    "codex",
    "--base-url",
    params.baseUrl,
    "--prompt",
    params.prompt,
    "--timeout-ms",
    String(params.timeoutMs),
  ];

  if (params.model) {
    smokeArgs.push("--model", params.model);
  }
  if (params.jsonOutput) {
    smokeArgs.push("--json");
  }

  if (!params.jsonOutput) {
    console.log(
      `[local-codex-plugin-smoke] running smoke with model ${params.model || "(config default)"}...`,
    );
  }

  return spawnSync(process.execPath, smokeArgs, {
    cwd: repoRoot,
    env: params.env,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function printHumanSummary(params) {
  console.log(params.stdout);
  console.log("");
  console.log(`[local-codex-plugin-smoke] local Codex plugin is now running from source.`);
  console.log(`[local-codex-plugin-smoke] base URL: ${params.baseUrl}`);
  console.log(`[local-codex-plugin-smoke] service log: ${params.serviceLogPath}`);
  console.log(`[local-codex-plugin-smoke] cleanup: kill ${params.servicePid}`);
  console.log(
    `[local-codex-plugin-smoke] plugin source: plugins.entries.${PLUGIN_ID}.source=development`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceConfigPath = resolveSourceConfigPath(options.sourceConfig);
  ensureSourceConfigExists(sourceConfigPath);

  const prepared = prepareLocalHome(options, sourceConfigPath);
  const port = await findAvailablePort(options.uiPort || DEFAULT_PORT);

  if (!options.json) {
    console.log(`[local-codex-plugin-smoke] NEXTCLAW_HOME=${prepared.homeDir}`);
  }

  configureLocalCodexDevelopmentPlugin(prepared.env, options.json);
  const service = startLocalService(prepared.env, port, options.json);

  try {
    await waitForHealthyCodex(service.baseUrl, options.timeoutMs);
  } catch (error) {
    const logTail = tailFile(service.serviceLogPath);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
        `Service log tail:\n${logTail || "(empty)"}`,
    );
  }

  const smokeResult = runLocalCodexSmoke({
    env: prepared.env,
    baseUrl: service.baseUrl,
    prompt: options.prompt.trim(),
    timeoutMs: options.timeoutMs,
    model: prepared.selectedModel,
    jsonOutput: options.json,
  });

  const stdout = typeof smokeResult.stdout === "string" ? smokeResult.stdout.trim() : "";
  const stderr = typeof smokeResult.stderr === "string" ? smokeResult.stderr.trim() : "";

  if (!options.keepRunning) {
    killDetachedProcess(service.serviceProcess.pid);
  }

  if (smokeResult.status !== 0) {
    throw new Error([stdout, stderr].filter(Boolean).join("\n"));
  }

  const summary = {
    ok: true,
    homeDir: prepared.homeDir,
    baseUrl: service.baseUrl,
    port,
    model: prepared.selectedModel || null,
    pluginId: PLUGIN_ID,
    pluginPath,
    sourceConfigPath: prepared.sourceConfigPath,
    servicePid: service.serviceProcess.pid,
    serviceLogPath: service.serviceLogPath,
    keepRunning: options.keepRunning,
  };

  if (options.json) {
    const smokeJson = stdout ? JSON.parse(stdout) : {};
    console.log(JSON.stringify({ ...summary, smoke: smokeJson }, null, 2));
    return;
  }

  printHumanSummary({
    stdout,
    baseUrl: service.baseUrl,
    serviceLogPath: service.serviceLogPath,
    servicePid: service.serviceProcess.pid,
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
