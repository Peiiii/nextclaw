import { loadConfig, saveConfig, getConfigPath, getDataDir, getWorkspacePath, expandHome, resolveConfigSecrets, APP_NAME, DEFAULT_WORKSPACE_DIR, DEFAULT_WORKSPACE_PATH } from "@nextclaw/core";
import { NextclawKernel, type LlmProviderRuntime } from "@nextclaw/kernel";
import { RemoteRuntimeActions } from "@nextclaw/remote";
import {
  getPluginChannelBindings,
  resolvePluginChannelMessageToolHints,
  setPluginRuntimeBridge,
} from "@nextclaw/openclaw-compat";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { RestartCoordinator } from "@nextclaw-service/shared/services/restart/restart-coordinator.service.js";
import type { RestartStrategy } from "@nextclaw-service/shared/services/restart/restart-coordinator.service.js";
import { initializeConfigIfMissing } from "@nextclaw-service/shared/services/runtime/runtime-config-init.service.js";
import { writeRestartSentinel } from "@nextclaw-service/shared/services/restart/restart-sentinel.service.js";
import { createTopLevelNextclawCommandEnv } from "@nextclaw-service/shared/utils/top-level-nextclaw-command-env.utils.js";
import { logStartupTrace, measureStartupSync } from "@nextclaw-service/shared/utils/startup-trace.js";
import { getPackageVersion, isProcessRunning } from "@nextclaw-service/shared/utils/cli.utils.js";
import { NpmRuntimeUpdateCommandService } from "@nextclaw-service/launcher/npm-runtime-update-command.service.js";
import { NpmRuntimeLauncher } from "@nextclaw-service/launcher/npm-runtime-launcher.service.js";
import { managedServiceStateStore } from "@nextclaw-service/shared/stores/managed-service-state.store.js";
import { loadPluginRegistry, logPluginDiagnostics, mergePluginConfigView, toExtensionRegistry, toPluginConfigView, PluginCommands } from "@nextclaw-service/commands/plugin/index.js";
import { ConfigCommands } from "@nextclaw-service/cli/commands/config/index.js";
import { McpCommands } from "@nextclaw-service/cli/commands/mcp/index.js";
import { SecretsCommands } from "@nextclaw-service/cli/commands/secrets/index.js";
import { ChannelCommands } from "@nextclaw-service/commands/channel/index.js";
import { CronCommands } from "@nextclaw-service/cli/commands/cron/index.js";
import { AgentCommands, runCliAgentCommand } from "@nextclaw-service/cli/commands/agent/index.js";
import { PlatformAuthCommands } from "@nextclaw-service/commands/platform-auth/index.js";
import { RemoteCommands, hasRunningNextclawManagedService } from "@nextclaw-service/commands/remote/index.js";
import { DiagnosticsCommands } from "@nextclaw-service/cli/commands/diagnostics/index.js";
import { LogsCommands } from "@nextclaw-service/cli/commands/logs/index.js";
import { RuntimeCommandService } from "@nextclaw-service/shared/services/runtime/runtime-command.service.js";
import { ServiceCommands } from "@nextclaw-service/commands/service/index.js";
import { WorkspaceManager } from "@nextclaw-service/shared/services/workspace/workspace-manager.service.js";
import { LlmUsageObserver, ObservedProviderManager } from "@nextclaw-service/shared/services/telemetry/llm-usage-observer.service.js";
import { llmUsageRecorder } from "@nextclaw-service/shared/services/telemetry/llm-usage-recorder.service.js";
import { RuntimeRestartRequestService } from "@nextclaw-service/shared/services/restart/runtime-restart-request.service.js";
import { SkillsCommands } from "@nextclaw-service/cli/commands/skills/index.js";
import { GatewayCommands } from "@nextclaw-service/cli/commands/gateway/index.js";
import { UiCommands } from "@nextclaw-service/cli/commands/ui/index.js";
import { StartCommands } from "@nextclaw-service/cli/commands/start/index.js";
import { RestartCommands } from "@nextclaw-service/cli/commands/restart/index.js";
import { ServeCommands } from "@nextclaw-service/cli/commands/serve/index.js";
import { StopCommands } from "@nextclaw-service/cli/commands/stop/index.js";
import { CompanionCommands } from "@nextclaw-service/cli/commands/companion/index.js";
import { LlmUsageCommandService } from "@nextclaw-service/cli/commands/usage/index.js";
import type { AgentCommandOptions, LoginCommandOptions, RequestRestartParams, UpdateCommandOptions } from "@nextclaw-service/shared/types/cli.types.js";
const FORCED_PUBLIC_UI_HOST = "0.0.0.0";

export type NextclawServiceRuntimeOptions = {
  logo?: string;
};

export type NextclawServiceRuntimeAccount = {
  status: (opts?: { apiBase?: string; json?: boolean }) => Promise<void>;
  setUsername: (
    username: string,
    opts?: { apiBase?: string; json?: boolean },
  ) => Promise<void>;
};

export type NextclawServiceCommands = {
  remote: RemoteRuntimeActions;
  skills: SkillsCommands;
  service: ServiceCommands;
  config: ConfigCommands;
  mcp: McpCommands;
  secrets: SecretsCommands;
  plugins: PluginCommands;
  agents: AgentCommands;
  channels: ChannelCommands;
  cron: CronCommands;
  diagnostics: DiagnosticsCommands;
  logs: LogsCommands;
  gateway: GatewayCommands;
  ui: UiCommands;
  start: StartCommands;
  restart: RestartCommands;
  serve: ServeCommands;
  stop: StopCommands;
  companion: CompanionCommands;
  usage: LlmUsageCommandService;
};

export class NextclawServiceRuntime {
  private logo: string;
  private restartCoordinator: RestartCoordinator;
  private serviceRestartTask: Promise<boolean> | null = null;
  private selfRelaunchArmed = false;
  private restartRequestService: RuntimeRestartRequestService;
  private workspaceManager: WorkspaceManager;
  private runtimeCommandService: RuntimeCommandService;
  private platformAuthCommands!: PlatformAuthCommands;
  private remoteCommands!: RemoteCommands;
  account: NextclawServiceRuntimeAccount;
  commands: NextclawServiceCommands;
  constructor(options: NextclawServiceRuntimeOptions = {}) {
    logStartupTrace("cli.runtime.constructor.begin");
    this.logo = options.logo ?? "🤖";
    this.workspaceManager = measureStartupSync("cli.runtime.workspace_manager", () => new WorkspaceManager(this.logo));
    this.runtimeCommandService = measureStartupSync("cli.runtime.runtime_command_service", () => new RuntimeCommandService({
      requestRestart: (params) => this.requestRestart(params),
      initializeAgentHomeDirectory: (homeDirectory) => this.workspaceManager.createWorkspaceTemplates(homeDirectory)
    }));
    this.commands = this.createCommands();

    this.restartCoordinator = measureStartupSync("cli.runtime.restart_coordinator", () => new RestartCoordinator({
      readServiceState: managedServiceStateStore.read,
      isProcessRunning,
      currentPid: () => process.pid,
      restartBackgroundService: async (reason) =>
        this.restartBackgroundService(reason),
      scheduleProcessExit: (delayMs, reason) =>
        this.scheduleProcessExit(delayMs, reason),
    }));
    this.restartRequestService = new RuntimeRestartRequestService({
      armManagedServiceRelaunch: (params) => this.armManagedServiceRelaunch(params),
      requestRestartFromCoordinator: async (params) =>
        await this.restartCoordinator.requestRestart(params)
    });
    this.account = {
      status: async (opts = {}) => {
        await this.init({ source: "account status", auto: true });
        await this.platformAuthCommands.accountStatus(opts);
      },
      setUsername: async (username, opts = {}) => {
        await this.init({ source: "account set-username", auto: true });
        await this.platformAuthCommands.accountSetUsername({
          apiBase: opts.apiBase,
          json: opts.json,
          username
        });
      },
    };
    logStartupTrace("cli.runtime.constructor.end");
  }

  private createCommands = (): NextclawServiceCommands => {
    const start = measureStartupSync("cli.runtime.start_commands", () => new StartCommands({
      runtimeCommandService: this.runtimeCommandService,
      forcedPublicHost: FORCED_PUBLIC_UI_HOST,
      init: (params) => this.init(params)
    }));
    this.platformAuthCommands = measureStartupSync("cli.runtime.platform_auth_commands", () => new PlatformAuthCommands());
    this.remoteCommands = measureStartupSync("cli.runtime.remote_commands", () => new RemoteCommands());
    return {
      remote: measureStartupSync("cli.runtime.remote_runtime_actions", () => new RemoteRuntimeActions({
        appName: APP_NAME,
        initAuto: (source) => this.init({ source, auto: true }),
        remoteCommands: this.remoteCommands,
        restartBackgroundService: (reason) => this.restartBackgroundService(reason),
        hasRunningManagedService: hasRunningNextclawManagedService
      })),
      skills: measureStartupSync("cli.runtime.skills_commands", () => new SkillsCommands()),
      service: measureStartupSync("cli.runtime.service_commands", () => new ServiceCommands()),
      config: measureStartupSync("cli.runtime.config_commands", () => new ConfigCommands({
        requestRestart: (params) => this.requestRestart(params),
      })),
      mcp: measureStartupSync("cli.runtime.mcp_commands", () => new McpCommands()),
      secrets: measureStartupSync("cli.runtime.secrets_commands", () => new SecretsCommands({
        requestRestart: (params) => this.requestRestart(params),
      })),
      plugins: measureStartupSync("cli.runtime.plugin_commands", () => new PluginCommands()),
      agents: measureStartupSync("cli.runtime.agent_commands", () => new AgentCommands({
        initializeAgentHomeDirectory: (homeDirectory) => this.workspaceManager.createWorkspaceTemplates(homeDirectory)
      })),
      channels: measureStartupSync("cli.runtime.channel_commands", () => new ChannelCommands({
        logo: this.logo,
        getBridgeDir: () => this.workspaceManager.getBridgeDir(),
        requestRestart: (params) => this.requestRestart(params),
      })),
      cron: measureStartupSync("cli.runtime.cron_commands", () => new CronCommands()),
      diagnostics: measureStartupSync("cli.runtime.diagnostics_commands", () => new DiagnosticsCommands({ logo: this.logo })),
      logs: measureStartupSync("cli.runtime.logs_commands", () => new LogsCommands()),
      gateway: measureStartupSync("cli.runtime.gateway_commands", () => new GatewayCommands({
        runtimeCommandService: this.runtimeCommandService,
        forcedPublicHost: FORCED_PUBLIC_UI_HOST
      })),
      ui: measureStartupSync("cli.runtime.ui_commands", () => new UiCommands({
        runtimeCommandService: this.runtimeCommandService,
        forcedPublicHost: FORCED_PUBLIC_UI_HOST
      })),
      start,
      restart: measureStartupSync("cli.runtime.restart_commands", () => new RestartCommands({
        runtimeCommandService: this.runtimeCommandService,
        startCommands: start,
        forcedPublicHost: FORCED_PUBLIC_UI_HOST,
        writeRestartSentinelFromExecContext: (reason) => this.writeRestartSentinelFromExecContext(reason)
      })),
      serve: measureStartupSync("cli.runtime.serve_commands", () => new ServeCommands({
        runtimeCommandService: this.runtimeCommandService,
        forcedPublicHost: FORCED_PUBLIC_UI_HOST
      })),
      stop: measureStartupSync("cli.runtime.stop_commands", () => new StopCommands({
        runtimeCommandService: this.runtimeCommandService
      })),
      companion: measureStartupSync("cli.runtime.companion_commands", () => new CompanionCommands()),
      usage: measureStartupSync("cli.runtime.usage_commands", () => new LlmUsageCommandService()),
    };
  };

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
      const state = managedServiceStateStore.read();
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
      await this.runtimeCommandService.stopService();
      await this.runtimeCommandService.startService({
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
    const { delayMs: requestedDelayMs, reason, strategy: requestedStrategy } = params;
    const strategy = requestedStrategy ?? "background-service-or-manual";
    if (
      strategy !== "background-service-or-exit" &&
      strategy !== "exit-process"
    ) {
      return;
    }
    if (this.selfRelaunchArmed) {
      return;
    }

    const state = managedServiceStateStore.read();
    if (!state || state.pid !== process.pid) {
      return;
    }

    const uiPort =
      typeof state.uiPort === "number" && Number.isFinite(state.uiPort)
        ? state.uiPort
        : 55667;
    const delayMs =
      typeof requestedDelayMs === "number" && Number.isFinite(requestedDelayMs)
        ? Math.max(0, Math.floor(requestedDelayMs))
        : 100;
    const cliPath =
      process.env.NEXTCLAW_SELF_RELAUNCH_CLI?.trim() ||
      fileURLToPath(new URL("./index.js", import.meta.url));
    const startArgs = [cliPath, "start", "--ui-port", String(uiPort)];
    const serviceStatePath = managedServiceStateStore.path;
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
        env: createTopLevelNextclawCommandEnv(process.env),
      });
      helper.unref();
      this.selfRelaunchArmed = true;
      console.warn(`Gateway self-restart armed (${reason}).`);
    } catch (error) {
      console.error(`Failed to arm gateway self-restart: ${String(error)}`);
    }
  };

  private requestRestart = async (params: RequestRestartParams): Promise<void> => {
    await this.restartRequestService.run(params);
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
      const kernel = new NextclawKernel({
        workspace,
        homeDir: getDataDir(),
      });
      kernel.llmProviders.load(config);
      const providerManager = this.createObservedProviderManager(
        kernel.llmProviders,
        "cli-agent",
      );

      await runCliAgentCommand({
        logo: this.logo,
        opts,
        config,
        kernel,
        providerManager,
        extensionRegistry,
        loadResolvedConfig: () =>
          resolveConfigSecrets(loadConfig(), { configPath }),
        resolveMessageToolHints: ({ channel, accountId }) =>
          resolvePluginChannelMessageToolHints({
            registry: pluginRegistry,
            channel,
            cfg: resolveConfigSecrets(loadConfig(), { configPath }),
            accountId,
          }),
      });
    } finally {
      setPluginRuntimeBridge(null);
    }
  };

  update = async (opts: UpdateCommandOptions): Promise<void> => {
    const versionBefore = getPackageVersion();
    if (!opts.json) {
      console.log(`Current npm launcher version: ${versionBefore}`);
    }
    const snapshot = await new NpmRuntimeUpdateCommandService().run(opts);
    if (snapshot.status === "blocked" || snapshot.status === "failed") {
      process.exit(1);
    }

    const state = managedServiceStateStore.read();
    if (snapshot.requiresRestart && state && isProcessRunning(state.pid)) {
      console.log(`Tip: restart ${APP_NAME} to apply the update.`);
    }
  };

  private createObservedProviderManager = (providerManager: LlmProviderRuntime, source: string): LlmProviderRuntime =>
    new ObservedProviderManager(providerManager, new LlmUsageObserver(llmUsageRecorder, source));
}

export const runNextclawNpmRuntimeLauncher = (
  argv: string[] = process.argv,
): void => {
  new NpmRuntimeLauncher({ argv }).run();
};
