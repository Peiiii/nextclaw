#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const DEFAULT_PORT = 18888;
const DEFAULT_INSTANCE = "default";
const DEFAULT_START_TIMEOUT_MS = 45_000;
const DEFAULT_HOST = "127.0.0.1";
const VALID_ACTIONS = new Set(["start", "restart", "stop", "status"]);
const VALID_HOME_MODES = new Set(["shared-data", "clone-config", "temp", "current"]);

const repoRoot = resolveRepoPath(import.meta.url);
const cliEntryPath = resolve(repoRoot, "packages/nextclaw/dist/cli/app/index.js");

function binName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function printHelp() {
  console.log(`Usage: pnpm local:source-runtime -- <start|restart|stop|status> [options]

Runs the current repo build through packages/nextclaw/dist/cli/app/index.js.
It never resolves the ambient PATH nextclaw binary.

Options:
  --port <port>                 UI/API port (default: ${DEFAULT_PORT})
  --instance <name>             Persistent cloned-home instance name (default: ${DEFAULT_INSTANCE})
  --home-mode <mode>            shared-data | clone-config | temp | current (default: shared-data)
  --home-dir <path>             Explicit NEXTCLAW_HOME for this harness instance
  --run-home-dir <path>         Explicit NEXTCLAW_RUN_HOME for isolated runtime state
  --source-home <path>          Source home copied by clone-config (default: ~/.nextclaw)
  --start-timeout <ms>          CLI start/restart readiness timeout (default: ${DEFAULT_START_TIMEOUT_MS})
  --no-build                    Use existing dist without rebuilding
  --no-sync-config              Do not refresh config.json in clone-config mode
  --allow-current-home          Required when --home-mode current is used
  --open                        Ask NextClaw CLI to open the UI after start/restart
  --dry-run                     Print resolved command and paths without running start/restart/stop
  --json                        Print machine-readable status output
  --help                        Show this help

Examples:
  pnpm local:runtime
  pnpm local:runtime:restart
  pnpm local:runtime:stop
  pnpm local:source-runtime -- start --port 18889 --instance test-a
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function expandHome(value) {
  if (value === "~") {
    return homedir();
  }
  if (value.startsWith("~/")) {
    return resolve(homedir(), value.slice(2));
  }
  return value;
}

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const [rawAction, ...rest] = normalizedArgv;
  const options = {
    action: rawAction ?? "",
    port: DEFAULT_PORT,
    instance: DEFAULT_INSTANCE,
    homeMode: "shared-data",
    homeDir: "",
    runHomeDir: "",
    sourceHome: "~/.nextclaw",
    startTimeoutMs: DEFAULT_START_TIMEOUT_MS,
    build: true,
    syncConfig: true,
    allowCurrentHome: false,
    open: false,
    dryRun: false,
    json: false,
  };

  if (!options.action || options.action === "--help" || options.action === "-h") {
    printHelp();
    process.exit(0);
  }
  if (!VALID_ACTIONS.has(options.action)) {
    fail(`Unknown action: ${options.action}`);
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const next = rest[index + 1];
    if (arg === "--") {
      continue;
    }
    switch (arg) {
      case "--port":
        options.port = parsePositiveInteger(next, "--port");
        index += 1;
        break;
      case "--instance":
        options.instance = String(next ?? "").trim();
        index += 1;
        break;
      case "--home-mode":
        options.homeMode = String(next ?? "").trim();
        index += 1;
        break;
      case "--home-dir":
        options.homeDir = String(next ?? "").trim();
        index += 1;
        break;
      case "--run-home-dir":
        options.runHomeDir = String(next ?? "").trim();
        index += 1;
        break;
      case "--source-home":
        options.sourceHome = String(next ?? "").trim();
        index += 1;
        break;
      case "--start-timeout":
        options.startTimeoutMs = parsePositiveInteger(next, "--start-timeout");
        index += 1;
        break;
      case "--no-build":
        options.build = false;
        break;
      case "--no-sync-config":
        options.syncConfig = false;
        break;
      case "--allow-current-home":
        options.allowCurrentHome = true;
        break;
      case "--open":
        options.open = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  if (!options.instance) {
    fail("--instance cannot be empty");
  }
  if (!VALID_HOME_MODES.has(options.homeMode)) {
    fail(`--home-mode must be one of: ${[...VALID_HOME_MODES].join(", ")}`);
  }
  if (!options.sourceHome) {
    fail("--source-home cannot be empty");
  }
  return options;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: options.stdio ?? "inherit",
    env: options.env ?? process.env,
    encoding: options.encoding,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result;
}

class SourceRuntimeInstanceHarness {
  constructor(options) {
    this.options = options;
    this.homeDir = this.resolveHomeDir();
    this.runHomeDir = this.resolveRunHomeDir();
    this.baseUrl = `http://${DEFAULT_HOST}:${this.options.port}`;
  }

  run = async () => {
    if (this.options.action === "status") {
      await this.printStatus();
      return;
    }

    if (this.options.dryRun) {
      this.printDryRun();
      return;
    }
    this.prepareHome();
    if (this.options.build && this.options.action !== "stop") {
      this.buildCli();
    }
    this.assertCliEntryReady();
    this.runCli(this.resolveCliArgs());
    this.printActionSummary();
  };

  resolveHomeDir = () => {
    if (this.options.homeDir) {
      return resolve(expandHome(this.options.homeDir));
    }
    if (this.options.homeMode === "current") {
      if (!this.options.allowCurrentHome) {
        fail("--home-mode current requires --allow-current-home because it can control the real service state.");
      }
      return resolve(expandHome(this.options.sourceHome));
    }
    if (this.options.homeMode === "shared-data") {
      return resolve(expandHome(this.options.sourceHome));
    }
    if (this.options.homeMode === "temp") {
      if (this.options.action !== "start") {
        fail("--home-mode temp without --home-dir only works with start; pass the printed --home-dir for restart/stop/status.");
      }
      if (this.options.dryRun) {
        return resolve(tmpdir(), "nextclaw-source-runtime-<temp>");
      }
      return mkdtempSync(resolve(tmpdir(), "nextclaw-source-runtime-"));
    }
    return resolve(homedir(), ".nextclaw-source-runtime", this.options.instance);
  };

  resolveRunHomeDir = () => {
    if (this.options.runHomeDir) {
      return resolve(expandHome(this.options.runHomeDir));
    }
    if (this.options.homeMode === "shared-data") {
      return resolve(homedir(), ".nextclaw-source-runtime", this.options.instance, "run");
    }
    return "";
  };

  prepareHome = () => {
    mkdirSync(this.homeDir, { recursive: true });
    if (this.options.homeMode !== "clone-config" || !this.options.syncConfig) {
      return;
    }
    const sourceConfigPath = resolve(expandHome(this.options.sourceHome), "config.json");
    if (!existsSync(sourceConfigPath)) {
      console.warn(`[source-runtime] Source config not found, using defaults: ${sourceConfigPath}`);
      return;
    }
    const targetConfigPath = resolve(this.homeDir, "config.json");
    mkdirSync(dirname(targetConfigPath), { recursive: true });
    copyFileSync(sourceConfigPath, targetConfigPath);
    console.log(`[source-runtime] Synced config: ${sourceConfigPath} -> ${targetConfigPath}`);
  };

  buildCli = () => {
    console.log("[source-runtime] Building current source for nextclaw...");
    runCommand(binName("pnpm"), ["-r", "--filter", "nextclaw...", "build"]);
  };

  assertCliEntryReady = () => {
    if (!existsSync(cliEntryPath)) {
      fail(`Built CLI entry not found: ${cliEntryPath}\nRun: pnpm -r --filter nextclaw... build`);
    }
  };

  resolveCliArgs = () => {
    if (this.options.action === "stop") {
      return ["stop"];
    }
    const args = [
      this.options.action,
      "--ui-port",
      String(this.options.port),
      "--start-timeout",
      String(this.options.startTimeoutMs),
    ];
    if (this.options.open) {
      args.push("--open");
    }
    return args;
  };

  runCli = (args) => {
    console.log(`[source-runtime] NEXTCLAW_HOME=${this.homeDir}`);
    if (this.runHomeDir) {
      console.log(`[source-runtime] NEXTCLAW_RUN_HOME=${this.runHomeDir}`);
    }
    console.log(`[source-runtime] node ${cliEntryPath} ${args.join(" ")}`);
    runCommand(process.execPath, [cliEntryPath, ...args], {
      env: this.createCliEnv(),
    });
  };

  createCliEnv = () => ({
    ...process.env,
    NEXTCLAW_HOME: this.homeDir,
    ...(this.runHomeDir ? { NEXTCLAW_RUN_HOME: this.runHomeDir } : {}),
    NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST: "1",
  });

  printDryRun = () => {
    const payload = {
      action: this.options.action,
      cliEntryPath,
      homeDir: this.homeDir,
      runHomeDir: this.runHomeDir || null,
      baseUrl: this.baseUrl,
      command: `${process.execPath} ${cliEntryPath} ${this.resolveCliArgs().join(" ")}`,
      env: {
        NEXTCLAW_HOME: this.homeDir,
        NEXTCLAW_RUN_HOME: this.runHomeDir || undefined,
        NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST: "1",
      },
    };
    console.log(JSON.stringify(payload, null, 2));
  };

  printActionSummary = () => {
    if (this.options.action === "stop") {
      console.log("[source-runtime] Stopped source-built runtime instance.");
      return;
    }
    console.log(`[source-runtime] UI: ${this.baseUrl}`);
    console.log(`[source-runtime] API: ${this.baseUrl}/api`);
    console.log(`[source-runtime] NEXTCLAW_HOME: ${this.homeDir}`);
    if (this.runHomeDir) {
      console.log(`[source-runtime] NEXTCLAW_RUN_HOME: ${this.runHomeDir}`);
    }
    console.log(`[source-runtime] Restart: ${this.formatFollowupCommand("restart")}`);
    console.log(`[source-runtime] Stop:    ${this.formatFollowupCommand("stop")}`);
  };

  formatFollowupCommand = (action) => {
    const args = ["pnpm", "local:source-runtime", "--", action];
    if (this.options.port !== DEFAULT_PORT && action !== "stop") {
      args.push("--port", String(this.options.port));
    }
    if (this.options.instance !== DEFAULT_INSTANCE) {
      args.push("--instance", this.options.instance);
    }
    if (this.options.homeMode !== "shared-data") {
      args.push("--home-mode", this.options.homeMode, "--home-dir", this.homeDir);
    }
    if (this.runHomeDir && this.options.homeMode !== "shared-data") {
      args.push("--run-home-dir", this.runHomeDir);
    }
    if (action === "restart") {
      args.push("--no-build");
    }
    return args.join(" ");
  };

  printStatus = async () => {
    const health = await this.fetchJson("/api/health");
    const bootstrap = await this.fetchJson("/api/runtime/bootstrap-status");
    const payload = {
      baseUrl: this.baseUrl,
      homeDir: this.homeDir,
      runHomeDir: this.runHomeDir || null,
      health,
      bootstrap,
    };
    if (this.options.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(`[source-runtime] UI: ${this.baseUrl}`);
    console.log(`[source-runtime] NEXTCLAW_HOME: ${this.homeDir}`);
    if (this.runHomeDir) {
      console.log(`[source-runtime] NEXTCLAW_RUN_HOME: ${this.runHomeDir}`);
    }
    console.log(`[source-runtime] Health: ${health.ok ? "ok" : health.error}`);
    console.log(`[source-runtime] Bootstrap: ${bootstrap.ok ? "ok" : bootstrap.error}`);
  };

  fetchJson = async (path) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return {
        ok: response.ok,
        status: response.status,
        body,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        status: null,
        body: null,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  };
}

const harness = new SourceRuntimeInstanceHarness(parseArgs(process.argv.slice(2)));
await harness.run();
