import { loadConfig, saveConfig, getConfigPath, getDataDir, type Config, getWorkspacePath, expandHome, MessageBus, AgentLoop, ProviderManager, resolveConfigSecrets, APP_NAME, DEFAULT_WORKSPACE_DIR, DEFAULT_WORKSPACE_PATH } from "@nextclaw/core";
import { RemoteRuntimeActions } from "@nextclaw/remote";
import {
  getPluginChannelBindings,
  resolvePluginChannelMessageToolHints,
  setPluginRuntimeBridge,
} from "@nextclaw/openclaw-compat";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { RestartCoordinator, type RestartStrategy } from "./restart-coordinator.js";
import { initializeConfigIfMissing } from "./runtime-config-init.js";
import { writeRestartSentinel } from "./restart-sentinel.js";
import { parseStartTimeoutMs, resolveSkillsInstallWorkdir } from "./runtime-helpers.js";
import { logStartupTrace, measureStartupSync } from "./startup-trace.js";
import { installMarketplaceSkill, publishMarketplaceSkill } from "./skills/marketplace.js";
import { runSelfUpdate } from "./update/runner.js";
import { clearServiceState, getPackageVersion, isProcessRunning, printAgentResponse, prompt, readServiceState } from "./utils.js";
import {
  loadPluginRegistry,
  logPluginDiagnostics,
  mergePluginConfigView,
  toExtensionRegistry,
  toPluginConfigView,
  PluginCommands,
} from "./commands/plugins.js";
import { ConfigCommands } from "./commands/config.js";
import { McpCommands } from "./commands/mcp.js";
import { SecretsCommands } from "./commands/secrets.js";
import { ChannelCommands } from "./commands/channels.js";
import { CronCommands } from "./commands/cron.js";
import { AgentCommands } from "./commands/agents.js";
import { PlatformAuthCommands } from "./commands/platform-auth.js";
import { RemoteCommands } from "./commands/remote.js";
import { DiagnosticsCommands } from "./commands/diagnostics.js";
import { hasRunningNextclawManagedService } from "./commands/remote-support/remote-runtime-support.js";
import { ServiceCommands } from "./commands/service.js";
import { WorkspaceManager } from "./workspace.js";
import type {
  AgentCommandOptions,
  AgentsListCommandOptions,
  AgentsNewCommandOptions,
  AgentsRemoveCommandOptions,
  AgentsRuntimesCommandOptions,
  AgentsUpdateCommandOptions,
  ChannelsAddOptions,
  ChannelsLoginOptions,
  ConfigGetOptions,
  ConfigSetOptions,
  CronAddOptions,
  DoctorCommandOptions,
  GatewayCommandOptions,
  LoginCommandOptions,
  McpAddCommandOptions,
  McpDoctorOptions,
  McpListOptions,
  PluginsInfoOptions,
  PluginsInstallOptions,
  PluginsListOptions,
  PluginsUninstallOptions,
  SecretsApplyOptions,
  SecretsAuditOptions,
  SecretsConfigureOptions,
  SecretsReloadOptions,
  RequestRestartParams,
  StartCommandOptions,
  StatusCommandOptions,
  UiCommandOptions,
  UpdateCommandOptions,
} from "./types.js";

export const LOGO = "🤖";

const EXIT_COMMANDS = new Set(["exit", "quit", "/exit", "/quit", ":q"]);
const FORCED_PUBLIC_UI_HOST = "0.0.0.0";

export class CliRuntime {
  private logo: string;
  private restartCoordinator: RestartCoordinator;
  private serviceRestartTask: Promise<boolean> | null = null;
  private selfRelaunchArmed = false;
  private workspaceManager: WorkspaceManager;
  private serviceCommands: ServiceCommands;
  private configCommands: ConfigCommands;
  private mcpCommands: McpCommands;
  private secretsCommands: SecretsCommands;
  private pluginCommands: PluginCommands;
  private agentCommands: AgentCommands;
  private channelCommands: ChannelCommands;
  private cronCommands: CronCommands;
  private platformAuthCommands: PlatformAuthCommands;
  private remoteCommands: RemoteCommands;
  readonly remote: RemoteRuntimeActions;
  private diagnosticsCommands: DiagnosticsCommands;
  constructor(options: { logo?: string } = {}) {
    logStartupTrace("cli.runtime.constructor.begin");
    this.logo = options.logo ?? LOGO;
    this.workspaceManager = measureStartupSync("cli.runtime.workspace_manager", () => new WorkspaceManager(this.logo));

    this.serviceCommands = measureStartupSync("cli.runtime.service_commands", () => new ServiceCommands({
      requestRestart: (params) => this.requestRestart(params),
      initializeAgentHomeDirectory: (homeDirectory) => this.workspaceManager.createWorkspaceTemplates(homeDirectory)
    }));
    this.configCommands = measureStartupSync("cli.runtime.config_commands", () => new ConfigCommands({
      requestRestart: (params) => this.requestRestart(params),
    }));
    this.mcpCommands = measureStartupSync("cli.runtime.mcp_commands", () => new McpCommands());
    this.secretsCommands = measureStartupSync("cli.runtime.secrets_commands", () => new SecretsCommands({
      requestRestart: (params) => this.requestRestart(params),
    }));
    this.pluginCommands = measureStartupSync("cli.runtime.plugin_commands", () => new PluginCommands());
    this.agentCommands = measureStartupSync("cli.runtime.agent_commands", () => new AgentCommands({
      initializeAgentHomeDirectory: (homeDirectory) => this.workspaceManager.createWorkspaceTemplates(homeDirectory)
    }));
    this.channelCommands = measureStartupSync("cli.runtime.channel_commands", () => new ChannelCommands({
      logo: this.logo,
      getBridgeDir: () => this.workspaceManager.getBridgeDir(),
      requestRestart: (params) => this.requestRestart(params),
    }));
    this.cronCommands = measureStartupSync("cli.runtime.cron_commands", () => new CronCommands());
    this.platformAuthCommands = measureStartupSync("cli.runtime.platform_auth_commands", () => new PlatformAuthCommands());
    this.remoteCommands = measureStartupSync("cli.runtime.remote_commands", () => new RemoteCommands());
    this.remote = measureStartupSync("cli.runtime.remote_runtime_actions", () => new RemoteRuntimeActions({
      appName: APP_NAME,
      initAuto: (source) => this.init({ source, auto: true }),
      remoteCommands: this.remoteCommands,
      restartBackgroundService: (reason) => this.restartBackgroundService(reason),
      hasRunningManagedService: hasRunningNextclawManagedService
    }));
    this.diagnosticsCommands = measureStartupSync("cli.runtime.diagnostics_commands", () => new DiagnosticsCommands({ logo: this.logo }));

    this.restartCoordinator = measureStartupSync("cli.runtime.restart_coordinator", () => new RestartCoordinator({
      readServiceState,
      isProcessRunning,
      currentPid: () => process.pid,
      restartBackgroundService: async (reason) =>
        this.restartBackgroundService(reason),
      scheduleProcessExit: (delayMs, reason) =>
        this.scheduleProcessExit(delayMs, reason),
    }));
    logStartupTrace("cli.runtime.constructor.end");
  }

  get version(): string {
    return getPackageVersion();
  }

  private scheduleProcessExit = (delayMs: number, reason: string): void => {
    console.warn(`Gateway restart requested (${reason}).`);
    setTimeout(() => {
      process.exit(0);
    }, delayMs);
  };

  private restartBackgroundService = async (reason: string): Promise<boolean> => {
    if (this.serviceRestartTask) {
      return this.serviceRestartTask;
    }

    this.serviceRestartTask = (async () => {
      const state = readServiceState();
      if (!state || !isProcessRunning(state.pid) || state.pid === process.pid) {
        return false;
      }

      const uiHost = FORCED_PUBLIC_UI_HOST;
      const uiPort =
        typeof state.uiPort === "number" && Number.isFinite(state.uiPort)
          ? state.uiPort
          : 55667;

      console.log(
        `Applying changes (${reason}): restarting ${APP_NAME} background service...`,
      );
      await this.serviceCommands.stopService();
      await this.serviceCommands.startService({
        uiOverrides: {
          enabled: true,
          host: uiHost,
          port: uiPort,
        },
        open: false,
      });
      return true;
    })();

    try {
      return await this.serviceRestartTask;
    } finally {
      this.serviceRestartTask = null;
    }
  };

  private armManagedServiceRelaunch = (params: {
    reason: string;
    strategy?: RestartStrategy;
    delayMs?: number;
  }): void => {
    const strategy = params.strategy ?? "background-service-or-manual";
    if (
      strategy !== "background-service-or-exit" &&
      strategy !== "exit-process"
    ) {
      return;
    }
    if (this.selfRelaunchArmed) {
      return;
    }

    const state = readServiceState();
    if (!state || state.pid !== process.pid) {
      return;
    }

    const uiPort =
      typeof state.uiPort === "number" && Number.isFinite(state.uiPort)
        ? state.uiPort
        : 55667;
    const delayMs =
      typeof params.delayMs === "number" && Number.isFinite(params.delayMs)
        ? Math.max(0, Math.floor(params.delayMs))
        : 100;
    const cliPath =
      process.env.NEXTCLAW_SELF_RELAUNCH_CLI?.trim() ||
      fileURLToPath(new URL("./index.js", import.meta.url));
    const startArgs = [cliPath, "start", "--ui-port", String(uiPort)];
    const serviceStatePath = resolve(getDataDir(), "run", "service.json");
    const helperScript = [
      'const { spawnSync } = require("node:child_process");',
      'const { readFileSync } = require("node:fs");',
      `const parentPid = ${process.pid};`,
      `const delayMs = ${delayMs};`,
      "const maxWaitMs = 120000;",
      "const retryIntervalMs = 1000;",
      "const startTimeoutMs = 60000;",
      `const nodePath = ${JSON.stringify(process.execPath)};`,
      `const startArgs = ${JSON.stringify(startArgs)};`,
      `const serviceStatePath = ${JSON.stringify(serviceStatePath)};`,
      "function isRunning(pid) {",
      "  try {",
      "    process.kill(pid, 0);",
      "    return true;",
      "  } catch {",
      "    return false;",
      "  }",
      "}",
      "function hasReplacementService() {",
      "  try {",
      '    const raw = readFileSync(serviceStatePath, "utf-8");',
      "    const state = JSON.parse(raw);",
      "    const pid = Number(state?.pid);",
      "    return Number.isFinite(pid) && pid > 0 && pid !== parentPid && isRunning(pid);",
      "  } catch {",
      "    return false;",
      "  }",
      "}",
      "function tryStart() {",
      "  spawnSync(nodePath, startArgs, {",
      '    stdio: "ignore",',
      "    env: process.env,",
      "    timeout: startTimeoutMs",
      "  });",
      "}",
      "setTimeout(() => {",
      "  const startedAt = Date.now();",
      "  const tick = () => {",
      "    if (hasReplacementService()) {",
      "      process.exit(0);",
      "      return;",
      "    }",
      "    if (Date.now() - startedAt >= maxWaitMs) {",
      "      process.exit(0);",
      "      return;",
      "    }",
      "    tryStart();",
      "    if (hasReplacementService()) {",
      "      process.exit(0);",
      "      return;",
      "    }",
      "    setTimeout(tick, retryIntervalMs);",
      "  };",
      "  tick();",
      "}, delayMs);",
    ].join("\n");

    try {
      const helper = spawn(process.execPath, ["-e", helperScript], {
        detached: true,
        stdio: "ignore",
        env: process.env,
      });
      helper.unref();
      this.selfRelaunchArmed = true;
      console.warn(`Gateway self-restart armed (${params.reason}).`);
    } catch (error) {
      console.error(`Failed to arm gateway self-restart: ${String(error)}`);
    }
  };

  private requestRestart = async (params: RequestRestartParams): Promise<void> => {
    this.armManagedServiceRelaunch({
      reason: params.reason,
      strategy: params.strategy,
      delayMs: params.delayMs,
    });

    const result = await this.restartCoordinator.requestRestart({
      reason: params.reason,
      strategy: params.strategy,
      delayMs: params.delayMs,
      manualMessage: params.manualMessage,
    });

    if (
      result.status === "manual-required" ||
      result.status === "restart-in-progress"
    ) {
      console.log(result.message);
      return;
    }

    if (result.status === "service-restarted") {
      if (!params.silentOnServiceRestart) {
        console.log(result.message);
      }
      return;
    }

    console.warn(result.message);
  };

  private writeRestartSentinelFromExecContext = async (reason: string): Promise<void> => {
    const sessionKeyRaw = process.env.NEXTCLAW_RUNTIME_SESSION_KEY;
    const sessionKey =
      typeof sessionKeyRaw === "string" ? sessionKeyRaw.trim() : "";
    if (!sessionKey) {
      return;
    }

    try {
      await writeRestartSentinel({
        kind: "restart",
        status: "ok",
        ts: Date.now(),
        sessionKey,
        stats: {
          reason: reason || "cli.restart",
          strategy: "exec-tool",
        },
      });
    } catch (error) {
      console.warn(
        `Warning: failed to write restart sentinel from exec context: ${String(error)}`,
      );
    }
  };

  onboard = async (): Promise<void> => {
    console.warn(
      `Warning: ${APP_NAME} onboard is deprecated. Use "${APP_NAME} init" instead.`,
    );
    await this.init({ source: "onboard" });
  };

  init = async (options: { source?: string; auto?: boolean; force?: boolean } = {}): Promise<void> => {
    const source = options.source ?? "init";
    const prefix = options.auto ? "Auto init" : "Init";
    const force = Boolean(options.force);

    const configPath = getConfigPath();
    const createdConfig = initializeConfigIfMissing(configPath);

    const config = loadConfig();
    const workspaceSetting = config.agents.defaults.workspace;
    const workspacePath =
      !workspaceSetting || workspaceSetting === DEFAULT_WORKSPACE_PATH
        ? join(getDataDir(), DEFAULT_WORKSPACE_DIR)
        : expandHome(workspaceSetting);
    const workspaceExisted = existsSync(workspacePath);
    mkdirSync(workspacePath, { recursive: true });
    const templateResult = this.workspaceManager.createWorkspaceTemplates(
      workspacePath,
      { force },
    );

    if (createdConfig) {
      console.log(`✓ ${prefix}: created config at ${configPath}`);
    }
    if (!workspaceExisted) {
      console.log(`✓ ${prefix}: created workspace at ${workspacePath}`);
    }
    for (const file of templateResult.created) {
      console.log(`✓ ${prefix}: created ${file}`);
    }
    if (
      !createdConfig &&
      workspaceExisted &&
      templateResult.created.length === 0
    ) {
      console.log(`${prefix}: already initialized.`);
    }

    if (!options.auto) {
      console.log(`\n${this.logo} ${APP_NAME} is ready! (${source})`);
      console.log("\nNext steps:");
      console.log(`  1. Add your API key to ${configPath}`);
      console.log(`  2. Chat: ${APP_NAME} agent -m "Hello!"`);
    } else {
      console.log(
        `Tip: Run "${APP_NAME} init${force ? " --force" : ""}" to re-run initialization if needed.`,
      );
    }
  };

  login = async (opts: LoginCommandOptions = {}): Promise<void> => {
    await this.init({ source: "login", auto: true });
    await this.platformAuthCommands.login(opts);
  };

  gateway = async (opts: GatewayCommandOptions): Promise<void> => {
    const uiOverrides: Partial<Config["ui"]> = {
      host: FORCED_PUBLIC_UI_HOST,
    };
    if (opts.ui) {
      uiOverrides.enabled = true;
    }
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }
    if (opts.uiOpen) {
      uiOverrides.open = true;
    }
    await this.serviceCommands.startGateway({ uiOverrides });
  };

  ui = async (opts: UiCommandOptions): Promise<void> => {
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      host: FORCED_PUBLIC_UI_HOST,
      open: Boolean(opts.open),
    };
    if (opts.port) {
      uiOverrides.port = Number(opts.port);
    }
    await this.serviceCommands.startGateway({
      uiOverrides,
      allowMissingProvider: true,
    });
  };

  start = async (opts: StartCommandOptions): Promise<void> => {
    const startupTimeoutMs = parseStartTimeoutMs(opts.startTimeout);
    await this.init({ source: "start", auto: true });
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      host: FORCED_PUBLIC_UI_HOST,
      open: false,
    };
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }

    await this.serviceCommands.startService({
      uiOverrides,
      open: Boolean(opts.open),
      startupTimeoutMs,
    });
  };

  restart = async (opts: StartCommandOptions): Promise<void> => {
    await this.writeRestartSentinelFromExecContext("cli.restart");

    const state = readServiceState();
    if (state && isProcessRunning(state.pid)) {
      console.log(`Restarting ${APP_NAME}...`);
      await this.serviceCommands.stopService();
    } else if (state) {
      clearServiceState();
      console.log("Service state was stale and has been cleaned up.");
    } else {
      console.log("No running service found. Starting a new service.");
    }

    await this.start(opts);
  };

  serve = async (opts: StartCommandOptions): Promise<void> => {
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      host: FORCED_PUBLIC_UI_HOST,
      open: false,
    };
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }

    await this.serviceCommands.runForeground({
      uiOverrides,
      open: Boolean(opts.open),
    });
  };

  stop = async (): Promise<void> => {
    await this.serviceCommands.stopService();
  };

  agent = async (opts: AgentCommandOptions): Promise<void> => {
    const configPath = getConfigPath();
    const config = resolveConfigSecrets(loadConfig(), { configPath });
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    const pluginRegistry = loadPluginRegistry(config, workspace);
    const extensionRegistry = toExtensionRegistry(pluginRegistry);
    logPluginDiagnostics(pluginRegistry);

    const pluginChannelBindings = getPluginChannelBindings(pluginRegistry);
    setPluginRuntimeBridge({
      loadConfig: () =>
        toPluginConfigView(
          resolveConfigSecrets(loadConfig(), { configPath }),
          pluginChannelBindings,
        ),
      writeConfigFile: async (nextConfigView) => {
        if (
          !nextConfigView ||
          typeof nextConfigView !== "object" ||
          Array.isArray(nextConfigView)
        ) {
          throw new Error(
            "plugin runtime writeConfigFile expects an object config",
          );
        }
        const current = loadConfig();
        const next = mergePluginConfigView(
          current,
          nextConfigView,
          pluginChannelBindings,
        );
        saveConfig(next);
      },
    });

    try {
      const bus = new MessageBus();
      const provider =
        this.serviceCommands.createProvider(config) ??
        this.serviceCommands.createMissingProvider(config);
      const providerManager = new ProviderManager({
        defaultProvider: provider,
        config,
      });
      const agentLoop = new AgentLoop({
        bus,
        providerManager,
        workspace,
        model: config.agents.defaults.model,
        maxIterations: config.agents.defaults.maxToolIterations,
        contextTokens: config.agents.defaults.contextTokens,
        searchConfig: config.search,
        execConfig: config.tools.exec,
        restrictToWorkspace: config.tools.restrictToWorkspace,
        contextConfig: config.agents.context,
        config,
        extensionRegistry,
        resolveMessageToolHints: ({ channel, accountId }) =>
          resolvePluginChannelMessageToolHints({
            registry: pluginRegistry,
            channel,
            cfg: resolveConfigSecrets(loadConfig(), { configPath }),
            accountId,
          }),
      });

      if (opts.message) {
        const response = await agentLoop.processDirect({
          content: opts.message,
          sessionKey: opts.session ?? "cli:default",
          channel: "cli",
          chatId: "direct",
          metadata:
            typeof opts.model === "string" && opts.model.trim()
              ? { model: opts.model.trim() }
              : {},
        });
        printAgentResponse(response);
        return;
      }

      console.log(
        `${this.logo} Interactive mode (type exit or Ctrl+C to quit)\n`,
      );
      const historyFile = join(getDataDir(), "history", "cli_history");
      const historyDir = resolve(historyFile, "..");
      mkdirSync(historyDir, { recursive: true });

      const history = existsSync(historyFile)
        ? readFileSync(historyFile, "utf-8").split("\n").filter(Boolean)
        : [];
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.on("close", () => {
        const merged = history.concat(
          (rl as unknown as { history: string[] }).history ?? [],
        );
        writeFileSync(historyFile, merged.join("\n"));
        process.exit(0);
      });

      let running = true;
      while (running) {
        const line = await prompt(rl, "You: ");
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        if (EXIT_COMMANDS.has(trimmed.toLowerCase())) {
          rl.close();
          running = false;
          break;
        }
        const response = await agentLoop.processDirect({
          content: trimmed,
          sessionKey: opts.session ?? "cli:default",
          metadata:
            typeof opts.model === "string" && opts.model.trim()
              ? { model: opts.model.trim() }
              : {},
        });
        printAgentResponse(response);
      }
    } finally {
      setPluginRuntimeBridge(null);
    }
  };

  update = async (opts: UpdateCommandOptions): Promise<void> => {
    let timeoutMs: number | undefined;
    if (opts.timeout !== undefined) {
      const parsed = Number(opts.timeout);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error(
          "Invalid --timeout value. Provide milliseconds (e.g. 1200000).",
        );
        process.exit(1);
      }
      timeoutMs = parsed;
    }

    const versionBefore = getPackageVersion();
    console.log(`Current version: ${versionBefore}`);

    const result = runSelfUpdate({ timeoutMs, cwd: process.cwd() });

    const printSteps = () => {
      for (const step of result.steps) {
        console.log(
          `- ${step.cmd} ${step.args.join(" ")} (code ${step.code ?? "?"})`,
        );
        if (step.stderr) {
          console.log(`  stderr: ${step.stderr}`);
        }
        if (step.stdout) {
          console.log(`  stdout: ${step.stdout}`);
        }
      }
    };

    if (!result.ok) {
      console.error(`Update failed: ${result.error ?? "unknown error"}`);
      if (result.steps.length > 0) {
        printSteps();
      }
      process.exit(1);
    }

    const versionAfter = getPackageVersion();
    console.log(`✓ Update complete (${result.strategy})`);
    if (versionAfter === versionBefore) {
      console.log(`Version unchanged: ${versionBefore}`);
    } else {
      console.log(`Version updated: ${versionBefore} -> ${versionAfter}`);
    }

    const state = readServiceState();
    if (state && isProcessRunning(state.pid)) {
      console.log(`Tip: restart ${APP_NAME} to apply the update.`);
    }
  };

  agentsList = (opts: AgentsListCommandOptions = {}): void => { this.agentCommands.agentsList(opts); };
  agentsRuntimes = async (opts: AgentsRuntimesCommandOptions = {}): Promise<void> => { await this.agentCommands.agentsRuntimes(opts); };
  agentsNew = async (agentId: string, opts: AgentsNewCommandOptions = {}): Promise<void> => { await this.agentCommands.agentsNew(agentId, opts); };
  agentsUpdate = async (agentId: string, opts: AgentsUpdateCommandOptions = {}): Promise<void> => { await this.agentCommands.agentsUpdate(agentId, opts); };
  agentsRemove = async (agentId: string, opts: AgentsRemoveCommandOptions = {}): Promise<void> => { await this.agentCommands.agentsRemove(agentId, opts); };

  pluginsList = (opts: PluginsListOptions = {}): void => { this.pluginCommands.pluginsList(opts); };
  pluginsInfo = (id: string, opts: PluginsInfoOptions = {}): void => { this.pluginCommands.pluginsInfo(id, opts); };

  pluginsEnable = async (id: string): Promise<void> => {
    await this.pluginCommands.pluginsEnable(id);
  };

  pluginsDisable = async (id: string): Promise<void> => {
    await this.pluginCommands.pluginsDisable(id);
  };

  pluginsUninstall = async (id: string, opts: PluginsUninstallOptions = {}): Promise<void> => {
    await this.pluginCommands.pluginsUninstall(id, opts);
  };

  pluginsInstall = async (pathOrSpec: string, opts: PluginsInstallOptions = {}): Promise<void> => {
    await this.pluginCommands.pluginsInstall(pathOrSpec, opts);
  };

  pluginsDoctor = (): void => {
    this.pluginCommands.pluginsDoctor();
  };

  configGet = (pathExpr: string, opts: ConfigGetOptions = {}): void => {
    this.configCommands.configGet(pathExpr, opts);
  };

  configSet = async (pathExpr: string, value: string, opts: ConfigSetOptions = {}): Promise<void> => {
    await this.configCommands.configSet(pathExpr, value, opts);
  };

  configUnset = async (pathExpr: string): Promise<void> => { await this.configCommands.configUnset(pathExpr); };
  mcpList = (opts: McpListOptions = {}): void => { this.mcpCommands.mcpList(opts); };
  mcpAdd = async (name: string, command: string[], opts: McpAddCommandOptions = {}): Promise<void> => { await this.mcpCommands.mcpAdd(name, command, opts); };
  mcpRemove = async (name: string): Promise<void> => { await this.mcpCommands.mcpRemove(name); };
  mcpEnable = async (name: string): Promise<void> => { await this.mcpCommands.mcpEnable(name); };
  mcpDisable = async (name: string): Promise<void> => { await this.mcpCommands.mcpDisable(name); };
  mcpDoctor = async (name?: string, opts: McpDoctorOptions = {}): Promise<void> => { await this.mcpCommands.mcpDoctor(name, opts); };
  secretsAudit = (opts: SecretsAuditOptions = {}): void => { this.secretsCommands.secretsAudit(opts); };
  secretsConfigure = async (opts: SecretsConfigureOptions): Promise<void> => { await this.secretsCommands.secretsConfigure(opts); };
  secretsApply = async (opts: SecretsApplyOptions): Promise<void> => { await this.secretsCommands.secretsApply(opts); };
  secretsReload = async (opts: SecretsReloadOptions = {}): Promise<void> => { await this.secretsCommands.secretsReload(opts); };
  channelsStatus = (): void => { this.channelCommands.channelsStatus(); };
  channelsLogin = async (opts: ChannelsLoginOptions): Promise<void> => { await this.channelCommands.channelsLogin(opts); };
  channelsAdd = async (opts: ChannelsAddOptions): Promise<void> => { await this.channelCommands.channelsAdd(opts); };

  readonly cronList = async (opts: { enabledOnly?: boolean }): Promise<void> => {
    await this.cronCommands.cronList(opts);
  };

  readonly cronAdd = async (opts: CronAddOptions): Promise<void> => {
    await this.cronCommands.cronAdd(opts);
  };

  readonly cronRemove = async (jobId: string): Promise<void> => {
    await this.cronCommands.cronRemove(jobId);
  };

  readonly cronEnable = async (jobId: string, opts: { disable?: boolean }): Promise<void> => {
    await this.cronCommands.cronEnable(jobId, opts);
  };

  readonly cronRun = async (jobId: string, opts: { force?: boolean }): Promise<void> => {
    await this.cronCommands.cronRun(jobId, opts);
  };

  status = async (opts: StatusCommandOptions = {}): Promise<void> => {
    await this.diagnosticsCommands.status(opts);
  };

  doctor = async (opts: DoctorCommandOptions = {}): Promise<void> => {
    await this.diagnosticsCommands.doctor(opts);
  };

  skillsInstall = async (options: {
    slug: string;
    workdir?: string;
    dir?: string;
    force?: boolean;
    apiBaseUrl?: string;
  }): Promise<void> => {
    const config = loadConfig();
    const workdir = resolveSkillsInstallWorkdir({
      explicitWorkdir: options.workdir,
      configuredWorkspace: config.agents.defaults.workspace
    });
    const result = await installMarketplaceSkill({
      slug: options.slug,
      workdir,
      dir: options.dir,
      force: options.force,
      apiBaseUrl: options.apiBaseUrl
    });

    if (result.alreadyInstalled) {
      console.log(`✓ ${result.slug} is already installed`);
    } else {
      console.log(`✓ Installed ${result.slug} (${result.source})`);
    }
    console.log(`  Path: ${result.destinationDir}`);
  };
  skillsPublish = async (options: {
    dir: string;
    meta?: string;
    slug?: string;
    name?: string;
    summary?: string;
    description?: string;
    author?: string;
    tag?: string[];
    sourceRepo?: string;
    homepage?: string;
    publishedAt?: string;
    updatedAt?: string;
    apiBaseUrl?: string;
    token?: string;
  }): Promise<void> => {
    const result = await publishMarketplaceSkill({
      skillDir: expandHome(options.dir),
      metaFile: options.meta ? expandHome(options.meta) : undefined,
      slug: options.slug,
      name: options.name,
      summary: options.summary,
      description: options.description,
      author: options.author,
      tags: options.tag,
      sourceRepo: options.sourceRepo,
      homepage: options.homepage,
      publishedAt: options.publishedAt,
      updatedAt: options.updatedAt,
      apiBaseUrl: options.apiBaseUrl,
      token: options.token
    });
    console.log(`${result.created ? `✓ Published new skill: ${result.slug}` : `✓ Updated skill: ${result.slug}`}\n  Files: ${result.fileCount}`);
  };

  skillsUpdate = async (options: {
    dir: string;
    meta?: string;
    slug?: string;
    name?: string;
    summary?: string;
    description?: string;
    author?: string;
    tag?: string[];
    sourceRepo?: string;
    homepage?: string;
    updatedAt?: string;
    apiBaseUrl?: string;
    token?: string;
  }): Promise<void> => {
    const result = await publishMarketplaceSkill({
      skillDir: expandHome(options.dir),
      metaFile: options.meta ? expandHome(options.meta) : undefined,
      slug: options.slug,
      name: options.name,
      summary: options.summary,
      description: options.description,
      author: options.author,
      tags: options.tag,
      sourceRepo: options.sourceRepo,
      homepage: options.homepage,
      updatedAt: options.updatedAt,
      apiBaseUrl: options.apiBaseUrl,
      token: options.token,
      requireExisting: true
    });
    console.log(`✓ Updated skill: ${result.slug}`);
    console.log(`  Files: ${result.fileCount}`);
  };
}
