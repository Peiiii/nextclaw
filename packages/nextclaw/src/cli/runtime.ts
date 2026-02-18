import {
  loadConfig,
  saveConfig,
  getConfigPath,
  getDataDir,
  ConfigSchema,
  getApiBase,
  getProvider,
  getProviderName,
  type Config,
  type ExtensionRegistry,
  buildReloadPlan,
  diffConfigPaths,
  getWorkspacePath,
  expandHome,
  MessageBus,
  AgentLoop,
  LiteLLMProvider,
  LLMProvider,
  ProviderManager,
  ChannelManager,
  SessionManager,
  CronService,
  HeartbeatService,
  PROVIDERS,
  APP_NAME,
  DEFAULT_WORKSPACE_DIR,
  DEFAULT_WORKSPACE_PATH
} from "@nextclaw/core";
import {
  loadOpenClawPlugins,
  buildPluginStatusReport,
  enablePluginInConfig,
  disablePluginInConfig,
  addPluginLoadPath,
  recordPluginInstall,
  installPluginFromPath,
  installPluginFromNpmSpec,
  uninstallPlugin,
  resolveUninstallDirectoryTarget,
  setPluginRuntimeBridge,
  getPluginChannelBindings,
  getPluginUiMetadataFromRegistry,
  resolvePluginChannelMessageToolHints,
  startPluginChannelGateways,
  stopPluginChannelGateways,
  type PluginChannelBinding,
  type PluginRegistry
} from "@nextclaw/openclaw-compat";
import { startUiServer } from "@nextclaw/server";
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";
import { GatewayControllerImpl } from "./gateway/controller.js";
import { RestartCoordinator, type RestartStrategy } from "./restart-coordinator.js";
import { installClawHubSkill } from "./skills/clawhub.js";
import { runSelfUpdate } from "./update/runner.js";
import type { ServiceState } from "./utils.js";
import {
  buildServeArgs,
  clearServiceState,
  getPackageVersion,
  isProcessRunning,
  openBrowser,
  printAgentResponse,
  prompt,
  readServiceState,
  resolveServiceLogPath,
  resolveUiApiBase,
  resolveUiConfig,
  resolveUiStaticDir,
  resolvePublicIp,
  isLoopbackHost,
  waitForExit,
  which,
  writeServiceState
} from "./utils.js";

export const LOGO = "🤖";

const EXIT_COMMANDS = new Set(["exit", "quit", "/exit", "/quit", ":q"]);

type GatewayCommandOptions = {
  ui?: boolean;
  uiHost?: string;
  uiPort?: string | number;
  uiOpen?: boolean;
  public?: boolean;
};

type UiCommandOptions = {
  host?: string;
  port?: string | number;
  open?: boolean;
  public?: boolean;
};

type StartCommandOptions = {
  uiHost?: string;
  uiPort?: string | number;
  open?: boolean;
  public?: boolean;
};

type AgentCommandOptions = {
  message?: string;
  session?: string;
  markdown?: boolean;
};

type UpdateCommandOptions = {
  timeout?: string | number;
};

type PluginsListOptions = {
  json?: boolean;
  enabled?: boolean;
  verbose?: boolean;
};

type PluginsInfoOptions = {
  json?: boolean;
};

type PluginsInstallOptions = {
  link?: boolean;
};

type PluginsUninstallOptions = {
  keepFiles?: boolean;
  keepConfig?: boolean;
  force?: boolean;
  dryRun?: boolean;
};

type ChannelsAddOptions = {
  channel: string;
  code?: string;
  token?: string;
  name?: string;
  url?: string;
  httpUrl?: string;
};

type ConfigGetOptions = {
  json?: boolean;
};

type ConfigSetOptions = {
  json?: boolean;
};

type CronAddOptions = {
  name: string;
  message: string;
  every?: string;
  cron?: string;
  at?: string;
  deliver?: boolean;
  to?: string;
  channel?: string;
};

function isIndexSegment(raw: string): boolean {
  return /^[0-9]+$/.test(raw);
}

function parseConfigPath(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const parts: string[] = [];
  let current = "";
  let i = 0;

  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (ch === "\\") {
      const next = trimmed[i + 1];
      if (next) {
        current += next;
      }
      i += 2;
      continue;
    }
    if (ch === ".") {
      if (current) {
        parts.push(current);
      }
      current = "";
      i += 1;
      continue;
    }
    if (ch === "[") {
      if (current) {
        parts.push(current);
      }
      current = "";
      const close = trimmed.indexOf("]", i);
      if (close === -1) {
        throw new Error(`Invalid path (missing "]"): ${raw}`);
      }
      const inside = trimmed.slice(i + 1, close).trim();
      if (!inside) {
        throw new Error(`Invalid path (empty "[]"): ${raw}`);
      }
      parts.push(inside);
      i = close + 1;
      continue;
    }
    current += ch;
    i += 1;
  }

  if (current) {
    parts.push(current);
  }

  return parts.map((part) => part.trim()).filter(Boolean);
}

function parseRequiredConfigPath(raw: string): string[] {
  const parsedPath = parseConfigPath(raw);
  if (parsedPath.length === 0) {
    throw new Error("Path is empty.");
  }
  return parsedPath;
}

function parseConfigSetValue(raw: string, opts: ConfigSetOptions): unknown {
  const trimmed = raw.trim();
  if (opts.json) {
    return JSON.parse(trimmed);
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

function getAtConfigPath(root: unknown, pathSegments: string[]): { found: boolean; value?: unknown } {
  let current: unknown = root;
  for (const segment of pathSegments) {
    if (!current || typeof current !== "object") {
      return { found: false };
    }

    if (Array.isArray(current)) {
      if (!isIndexSegment(segment)) {
        return { found: false };
      }
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index) || index < 0 || index >= current.length) {
        return { found: false };
      }
      current = current[index];
      continue;
    }

    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return { found: false };
    }
    current = record[segment];
  }

  return { found: true, value: current };
}

function setAtConfigPath(root: Record<string, unknown>, pathSegments: string[], value: unknown): void {
  let current: unknown = root;

  for (let i = 0; i < pathSegments.length - 1; i += 1) {
    const segment = pathSegments[i];
    const next = pathSegments[i + 1];
    const nextIsIndex = Boolean(next && isIndexSegment(next));

    if (Array.isArray(current)) {
      if (!isIndexSegment(segment)) {
        throw new Error(`Expected numeric index for array segment "${segment}"`);
      }
      const index = Number.parseInt(segment, 10);
      const existing = current[index];
      if (!existing || typeof existing !== "object") {
        current[index] = nextIsIndex ? [] : {};
      }
      current = current[index];
      continue;
    }

    if (!current || typeof current !== "object") {
      throw new Error(`Cannot traverse into "${segment}" (not an object)`);
    }

    const record = current as Record<string, unknown>;
    const existing = record[segment];
    if (!existing || typeof existing !== "object") {
      record[segment] = nextIsIndex ? [] : {};
    }
    current = record[segment];
  }

  const last = pathSegments[pathSegments.length - 1];
  if (Array.isArray(current)) {
    if (!isIndexSegment(last)) {
      throw new Error(`Expected numeric index for array segment "${last}"`);
    }
    const index = Number.parseInt(last, 10);
    current[index] = value;
    return;
  }

  if (!current || typeof current !== "object") {
    throw new Error(`Cannot set "${last}" (parent is not an object)`);
  }

  (current as Record<string, unknown>)[last] = value;
}

function unsetAtConfigPath(root: Record<string, unknown>, pathSegments: string[]): boolean {
  let current: unknown = root;

  for (let i = 0; i < pathSegments.length - 1; i += 1) {
    const segment = pathSegments[i];
    if (!current || typeof current !== "object") {
      return false;
    }

    if (Array.isArray(current)) {
      if (!isIndexSegment(segment)) {
        return false;
      }
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index) || index < 0 || index >= current.length) {
        return false;
      }
      current = current[index];
      continue;
    }

    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return false;
    }
    current = record[segment];
  }

  const last = pathSegments[pathSegments.length - 1];
  if (Array.isArray(current)) {
    if (!isIndexSegment(last)) {
      return false;
    }
    const index = Number.parseInt(last, 10);
    if (!Number.isFinite(index) || index < 0 || index >= current.length) {
      return false;
    }
    current.splice(index, 1);
    return true;
  }

  if (!current || typeof current !== "object") {
    return false;
  }

  const record = current as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, last)) {
    return false;
  }
  delete record[last];
  return true;
}

class MissingProvider extends LLMProvider {
  constructor(private defaultModel: string) {
    super(null, null);
  }

  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  async chat(): Promise<never> {
    throw new Error("No API key configured yet. Configure provider credentials in UI and retry.");
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }
}

class ConfigReloader {
  private currentConfig: Config;
  private channels: ChannelManager;
  private reloadTask: Promise<void> | null = null;
  private providerReloadTask: Promise<void> | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private reloadRunning = false;
  private reloadPending = false;

  constructor(
    private options: {
      initialConfig: Config;
      channels: ChannelManager;
      bus: MessageBus;
      sessionManager: SessionManager;
      providerManager: ProviderManager | null;
      makeProvider: (config: Config) => LLMProvider | null;
      loadConfig: () => Config;
      getExtensionChannels?: () => ExtensionRegistry["channels"];
      applyAgentRuntimeConfig?: (config: Config) => void;
      onRestartRequired: (paths: string[]) => void;
    }
  ) {
    this.currentConfig = options.initialConfig;
    this.channels = options.channels;
  }

  getChannels(): ChannelManager {
    return this.channels;
  }

  setApplyAgentRuntimeConfig(callback: ((config: Config) => void) | undefined): void {
    this.options.applyAgentRuntimeConfig = callback;
  }

  async applyReloadPlan(nextConfig: Config): Promise<void> {
    const changedPaths = diffConfigPaths(this.currentConfig, nextConfig);
    if (!changedPaths.length) {
      return;
    }
    this.currentConfig = nextConfig;
    const plan = buildReloadPlan(changedPaths);
    if (plan.restartChannels) {
      await this.reloadChannels(nextConfig);
      console.log("Config reload: channels restarted.");
    }
    if (plan.reloadProviders) {
      await this.reloadProvider(nextConfig);
      console.log("Config reload: provider settings applied.");
    }
    if (plan.reloadAgent) {
      this.options.applyAgentRuntimeConfig?.(nextConfig);
      console.log("Config reload: agent defaults applied.");
    }
    if (plan.restartRequired.length > 0) {
      this.options.onRestartRequired(plan.restartRequired);
    }
  }

  scheduleReload(reason: string): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = setTimeout(() => {
      void this.runReload(reason);
    }, 300);
  }

  async runReload(reason: string): Promise<void> {
    if (this.reloadRunning) {
      this.reloadPending = true;
      return;
    }
    this.reloadRunning = true;
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
    try {
      const nextConfig = this.options.loadConfig();
      await this.applyReloadPlan(nextConfig);
    } catch (error) {
      console.error(`Config reload failed (${reason}): ${String(error)}`);
    } finally {
      this.reloadRunning = false;
      if (this.reloadPending) {
        this.reloadPending = false;
        this.scheduleReload("pending");
      }
    }
  }

  async reloadConfig(reason?: string): Promise<string> {
    await this.runReload(reason ?? "gateway tool");
    return "Config reload triggered";
  }

  private async reloadChannels(nextConfig: Config): Promise<void> {
    if (this.reloadTask) {
      await this.reloadTask;
      return;
    }
    this.reloadTask = (async () => {
      await this.channels.stopAll();
      this.channels = new ChannelManager(
        nextConfig,
        this.options.bus,
        this.options.sessionManager,
        this.options.getExtensionChannels?.() ?? []
      );
      await this.channels.startAll();
    })();
    try {
      await this.reloadTask;
    } finally {
      this.reloadTask = null;
    }
  }

  private async reloadProvider(nextConfig: Config): Promise<void> {
    if (!this.options.providerManager) {
      return;
    }
    if (this.providerReloadTask) {
      await this.providerReloadTask;
      return;
    }
    this.providerReloadTask = (async () => {
      const nextProvider = this.options.makeProvider(nextConfig);
      if (!nextProvider) {
        console.warn("Provider reload skipped: missing API key.");
        return;
      }
      this.options.providerManager?.set(nextProvider);
    })();
    try {
      await this.providerReloadTask;
    } finally {
      this.providerReloadTask = null;
    }
  }
}

export class CliRuntime {
  private logo: string;
  private restartCoordinator: RestartCoordinator;
  private serviceRestartTask: Promise<boolean> | null = null;

  constructor(options: { logo?: string } = {}) {
    this.logo = options.logo ?? LOGO;
    this.restartCoordinator = new RestartCoordinator({
      readServiceState,
      isProcessRunning,
      currentPid: () => process.pid,
      restartBackgroundService: async (reason) => this.restartBackgroundService(reason),
      scheduleProcessExit: (delayMs, reason) => this.scheduleProcessExit(delayMs, reason)
    });
  }

  get version(): string {
    return getPackageVersion();
  }

  private scheduleProcessExit(delayMs: number, reason: string): void {
    console.warn(`Gateway restart requested (${reason}).`);
    setTimeout(() => {
      process.exit(0);
    }, delayMs);
  }

  private async restartBackgroundService(reason: string): Promise<boolean> {
    if (this.serviceRestartTask) {
      return this.serviceRestartTask;
    }

    this.serviceRestartTask = (async () => {
      const state = readServiceState();
      if (!state || !isProcessRunning(state.pid) || state.pid === process.pid) {
        return false;
      }

      const uiHost = state.uiHost ?? "127.0.0.1";
      const uiPort = typeof state.uiPort === "number" && Number.isFinite(state.uiPort) ? state.uiPort : 18791;

      console.log(`Applying changes (${reason}): restarting ${APP_NAME} background service...`);
      await this.stopService();
      await this.startService({
        uiOverrides: {
          enabled: true,
          host: uiHost,
          port: uiPort
        },
        open: false
      });
      return true;
    })();

    try {
      return await this.serviceRestartTask;
    } finally {
      this.serviceRestartTask = null;
    }
  }

  private async requestRestart(params: {
    reason: string;
    manualMessage: string;
    strategy?: RestartStrategy;
    delayMs?: number;
    silentOnServiceRestart?: boolean;
  }): Promise<void> {
    const result = await this.restartCoordinator.requestRestart({
      reason: params.reason,
      strategy: params.strategy,
      delayMs: params.delayMs,
      manualMessage: params.manualMessage
    });

    if (result.status === "manual-required" || result.status === "restart-in-progress") {
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
  }

  async onboard(): Promise<void> {
    console.warn(`Warning: ${APP_NAME} onboard is deprecated. Use "${APP_NAME} init" instead.`);
    await this.init({ source: "onboard" });
  }

  async init(options: { source?: string; auto?: boolean; force?: boolean } = {}): Promise<void> {
    const source = options.source ?? "init";
    const prefix = options.auto ? "Auto init" : "Init";
    const force = Boolean(options.force);

    const configPath = getConfigPath();
    let createdConfig = false;
    if (!existsSync(configPath)) {
      const config = ConfigSchema.parse({});
      saveConfig(config);
      createdConfig = true;
    }

    const config = loadConfig();
    const workspaceSetting = config.agents.defaults.workspace;
    const workspacePath =
      !workspaceSetting || workspaceSetting === DEFAULT_WORKSPACE_PATH
        ? join(getDataDir(), DEFAULT_WORKSPACE_DIR)
        : expandHome(workspaceSetting);
    const workspaceExisted = existsSync(workspacePath);
    mkdirSync(workspacePath, { recursive: true });
    const templateResult = this.createWorkspaceTemplates(workspacePath, { force });

    if (createdConfig) {
      console.log(`✓ ${prefix}: created config at ${configPath}`);
    }
    if (!workspaceExisted) {
      console.log(`✓ ${prefix}: created workspace at ${workspacePath}`);
    }
    for (const file of templateResult.created) {
      console.log(`✓ ${prefix}: created ${file}`);
    }
    if (!createdConfig && workspaceExisted && templateResult.created.length === 0) {
      console.log(`${prefix}: already initialized.`);
    }

    if (!options.auto) {
      console.log(`\n${this.logo} ${APP_NAME} is ready! (${source})`);
      console.log("\nNext steps:");
      console.log(`  1. Add your API key to ${configPath}`);
      console.log(`  2. Chat: ${APP_NAME} agent -m "Hello!"`);
    } else {
      console.log(`Tip: Run "${APP_NAME} init${force ? " --force" : ""}" to re-run initialization if needed.`);
    }
  }

  async gateway(opts: GatewayCommandOptions): Promise<void> {
    const uiOverrides: Partial<Config["ui"]> = {};
    if (opts.ui) {
      uiOverrides.enabled = true;
    }
    if (opts.uiHost) {
      uiOverrides.host = String(opts.uiHost);
    }
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }
    if (opts.uiOpen) {
      uiOverrides.open = true;
    }
    if (opts.public) {
      uiOverrides.enabled = true;
      if (!opts.uiHost) {
        uiOverrides.host = "0.0.0.0";
      }
    }
    await this.startGateway({ uiOverrides });
  }

  async ui(opts: UiCommandOptions): Promise<void> {
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      open: Boolean(opts.open)
    };
    if (opts.host) {
      uiOverrides.host = String(opts.host);
    }
    if (opts.port) {
      uiOverrides.port = Number(opts.port);
    }
    if (opts.public && !opts.host) {
      uiOverrides.host = "0.0.0.0";
    }
    await this.startGateway({ uiOverrides, allowMissingProvider: true });
  }

  async start(opts: StartCommandOptions): Promise<void> {
    await this.init({ source: "start", auto: true });
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      open: false
    };
    if (opts.uiHost) {
      uiOverrides.host = String(opts.uiHost);
    }
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }
    if (opts.public && !opts.uiHost) {
      uiOverrides.host = "0.0.0.0";
    }

    await this.startService({
      uiOverrides,
      open: Boolean(opts.open)
    });
  }

  async restart(opts: StartCommandOptions): Promise<void> {
    const state = readServiceState();
    if (state && isProcessRunning(state.pid)) {
      console.log(`Restarting ${APP_NAME}...`);
      await this.stopService();
    } else if (state) {
      clearServiceState();
      console.log("Service state was stale and has been cleaned up.");
    } else {
      console.log("No running service found. Starting a new service.");
    }

    await this.start(opts);
  }

  async serve(opts: StartCommandOptions): Promise<void> {
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      open: false
    };
    if (opts.uiHost) {
      uiOverrides.host = String(opts.uiHost);
    }
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }
    if (opts.public && !opts.uiHost) {
      uiOverrides.host = "0.0.0.0";
    }

    await this.runForeground({
      uiOverrides,
      open: Boolean(opts.open)
    });
  }

  async stop(): Promise<void> {
    await this.stopService();
  }

  async agent(opts: AgentCommandOptions): Promise<void> {
    const config = loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    const pluginRegistry = this.loadPluginRegistry(config, workspace);
    const extensionRegistry = this.toExtensionRegistry(pluginRegistry);
    this.logPluginDiagnostics(pluginRegistry);

    const bus = new MessageBus();
    const provider = this.makeProvider(config);
    const providerManager = new ProviderManager(provider);
    const agentLoop = new AgentLoop({
      bus,
      providerManager,
      workspace,
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      restrictToWorkspace: config.tools.restrictToWorkspace,
      contextConfig: config.agents.context,
      config,
      extensionRegistry,
      resolveMessageToolHints: ({ channel, accountId }) =>
        resolvePluginChannelMessageToolHints({
          registry: pluginRegistry,
          channel,
          cfg: loadConfig(),
          accountId
        })
    });

    if (opts.message) {
      const response = await agentLoop.processDirect({
        content: opts.message,
        sessionKey: opts.session ?? "cli:default",
        channel: "cli",
        chatId: "direct"
      });
      printAgentResponse(response);
      return;
    }

    console.log(`${this.logo} Interactive mode (type exit or Ctrl+C to quit)\n`);
    const historyFile = join(getDataDir(), "history", "cli_history");
    const historyDir = resolve(historyFile, "..");
    mkdirSync(historyDir, { recursive: true });

    const history = existsSync(historyFile) ? readFileSync(historyFile, "utf-8").split("\n").filter(Boolean) : [];
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.on("close", () => {
      const merged = history.concat((rl as unknown as { history: string[] }).history ?? []);
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
        sessionKey: opts.session ?? "cli:default"
      });
      printAgentResponse(response);
    }
  }

  async update(opts: UpdateCommandOptions): Promise<void> {
    let timeoutMs: number | undefined;
    if (opts.timeout !== undefined) {
      const parsed = Number(opts.timeout);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error("Invalid --timeout value. Provide milliseconds (e.g. 1200000).");
        process.exit(1);
      }
      timeoutMs = parsed;
    }

    const result = runSelfUpdate({ timeoutMs, cwd: process.cwd() });

    const printSteps = () => {
      for (const step of result.steps) {
        console.log(`- ${step.cmd} ${step.args.join(" ")} (code ${step.code ?? "?"})`);
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

    console.log(`✓ Update complete (${result.strategy})`);

    const state = readServiceState();
    if (state && isProcessRunning(state.pid)) {
      console.log(`Tip: restart ${APP_NAME} to apply the update.`);
    }
  }

  pluginsList(opts: PluginsListOptions = {}): void {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: Object.keys(config.channels),
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
    });

    const list = opts.enabled ? report.plugins.filter((plugin) => plugin.status === "loaded") : report.plugins;

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            workspaceDir,
            plugins: list,
            diagnostics: report.diagnostics
          },
          null,
          2
        )
      );
      return;
    }

    if (list.length === 0) {
      console.log("No plugins discovered.");
      return;
    }

    for (const plugin of list) {
      const status = plugin.status === "loaded" ? "loaded" : plugin.status === "disabled" ? "disabled" : "error";
      const title = plugin.name && plugin.name !== plugin.id ? `${plugin.name} (${plugin.id})` : plugin.id;
      if (!opts.verbose) {
        const desc = plugin.description
          ? plugin.description.length > 80
            ? `${plugin.description.slice(0, 77)}...`
            : plugin.description
          : "(no description)";
        console.log(`${title} ${status} - ${desc}`);
        continue;
      }

      console.log(`${title} ${status}`);
      console.log(`  source: ${plugin.source}`);
      console.log(`  origin: ${plugin.origin}`);
      if (plugin.version) {
        console.log(`  version: ${plugin.version}`);
      }
      if (plugin.toolNames.length > 0) {
        console.log(`  tools: ${plugin.toolNames.join(", ")}`);
      }
      if (plugin.channelIds.length > 0) {
        console.log(`  channels: ${plugin.channelIds.join(", ")}`);
      }
      if (plugin.providerIds.length > 0) {
        console.log(`  providers: ${plugin.providerIds.join(", ")}`);
      }
      if (plugin.error) {
        console.log(`  error: ${plugin.error}`);
      }
      console.log("");
    }
  }

  pluginsInfo(id: string, opts: PluginsInfoOptions = {}): void {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: Object.keys(config.channels),
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
    });

    const plugin = report.plugins.find((entry) => entry.id === id || entry.name === id);
    if (!plugin) {
      console.error(`Plugin not found: ${id}`);
      process.exit(1);
    }

    if (opts.json) {
      console.log(JSON.stringify(plugin, null, 2));
      return;
    }

    const install = config.plugins.installs?.[plugin.id];
    const lines: string[] = [];
    lines.push(plugin.name || plugin.id);
    if (plugin.name && plugin.name !== plugin.id) {
      lines.push(`id: ${plugin.id}`);
    }
    if (plugin.description) {
      lines.push(plugin.description);
    }
    lines.push("");
    lines.push(`Status: ${plugin.status}`);
    lines.push(`Source: ${plugin.source}`);
    lines.push(`Origin: ${plugin.origin}`);
    if (plugin.version) {
      lines.push(`Version: ${plugin.version}`);
    }
    if (plugin.toolNames.length > 0) {
      lines.push(`Tools: ${plugin.toolNames.join(", ")}`);
    }
    if (plugin.channelIds.length > 0) {
      lines.push(`Channels: ${plugin.channelIds.join(", ")}`);
    }
    if (plugin.providerIds.length > 0) {
      lines.push(`Providers: ${plugin.providerIds.join(", ")}`);
    }
    if (plugin.error) {
      lines.push(`Error: ${plugin.error}`);
    }

    if (install) {
      lines.push("");
      lines.push(`Install: ${install.source}`);
      if (install.spec) {
        lines.push(`Spec: ${install.spec}`);
      }
      if (install.sourcePath) {
        lines.push(`Source path: ${install.sourcePath}`);
      }
      if (install.installPath) {
        lines.push(`Install path: ${install.installPath}`);
      }
      if (install.version) {
        lines.push(`Recorded version: ${install.version}`);
      }
      if (install.installedAt) {
        lines.push(`Installed at: ${install.installedAt}`);
      }
    }

    console.log(lines.join("\n"));
  }

  configGet(pathExpr: string, opts: ConfigGetOptions = {}): void {
    const config = loadConfig() as unknown as Record<string, unknown>;

    let parsedPath: string[];
    try {
      parsedPath = parseRequiredConfigPath(pathExpr);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    const result = getAtConfigPath(config, parsedPath);
    if (!result.found) {
      console.error(`Config path not found: ${pathExpr}`);
      process.exit(1);
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(result.value ?? null, null, 2));
      return;
    }

    if (
      typeof result.value === "string" ||
      typeof result.value === "number" ||
      typeof result.value === "boolean"
    ) {
      console.log(String(result.value));
      return;
    }

    console.log(JSON.stringify(result.value ?? null, null, 2));
  }

  async configSet(pathExpr: string, value: string, opts: ConfigSetOptions = {}): Promise<void> {
    let parsedPath: string[];
    try {
      parsedPath = parseRequiredConfigPath(pathExpr);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    let parsedValue: unknown;
    try {
      parsedValue = parseConfigSetValue(value, opts);
    } catch (error) {
      console.error(`Failed to parse config value: ${String(error)}`);
      process.exit(1);
      return;
    }

    const config = loadConfig() as unknown as Record<string, unknown>;
    try {
      setAtConfigPath(config, parsedPath, parsedValue);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    saveConfig(config as Config);
    await this.requestRestart({
      reason: `config.set ${pathExpr}`,
      manualMessage: `Updated ${pathExpr}. Restart the gateway to apply.`
    });
  }

  async configUnset(pathExpr: string): Promise<void> {
    let parsedPath: string[];
    try {
      parsedPath = parseRequiredConfigPath(pathExpr);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    const config = loadConfig() as unknown as Record<string, unknown>;
    const removed = unsetAtConfigPath(config, parsedPath);
    if (!removed) {
      console.error(`Config path not found: ${pathExpr}`);
      process.exit(1);
      return;
    }

    saveConfig(config as Config);
    await this.requestRestart({
      reason: `config.unset ${pathExpr}`,
      manualMessage: `Removed ${pathExpr}. Restart the gateway to apply.`
    });
  }

  async pluginsEnable(id: string): Promise<void> {
    const config = loadConfig();
    const next = enablePluginInConfig(config, id);
    saveConfig(next);
    await this.requestRestart({
      reason: `plugin enabled: ${id}`,
      manualMessage: `Enabled plugin "${id}". Restart the gateway to apply.`
    });
  }

  async pluginsDisable(id: string): Promise<void> {
    const config = loadConfig();
    const next = disablePluginInConfig(config, id);
    saveConfig(next);
    await this.requestRestart({
      reason: `plugin disabled: ${id}`,
      manualMessage: `Disabled plugin "${id}". Restart the gateway to apply.`
    });
  }

  async pluginsUninstall(id: string, opts: PluginsUninstallOptions = {}): Promise<void> {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: Object.keys(config.channels),
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
    });

    const keepFiles = Boolean(opts.keepFiles || opts.keepConfig);
    if (opts.keepConfig) {
      console.log("`--keep-config` is deprecated, use `--keep-files`.");
    }

    const plugin = report.plugins.find((entry) => entry.id === id || entry.name === id);
    const pluginId = plugin?.id ?? id;

    const hasEntry = pluginId in (config.plugins.entries ?? {});
    const hasInstall = pluginId in (config.plugins.installs ?? {});

    if (!hasEntry && !hasInstall) {
      if (plugin) {
        console.error(
          `Plugin "${pluginId}" is not managed by plugins config/install records and cannot be uninstalled.`
        );
      } else {
        console.error(`Plugin not found: ${id}`);
      }
      process.exit(1);
    }

    const install = config.plugins.installs?.[pluginId];
    const isLinked =
      install?.source === "path" &&
      (!install.installPath || !install.sourcePath || resolve(install.installPath) === resolve(install.sourcePath));

    const preview: string[] = [];
    if (hasEntry) {
      preview.push("config entry");
    }
    if (hasInstall) {
      preview.push("install record");
    }
    if (config.plugins.allow?.includes(pluginId)) {
      preview.push("allowlist entry");
    }
    if (isLinked && install?.sourcePath && config.plugins.load?.paths?.includes(install.sourcePath)) {
      preview.push("load path");
    }

    const deleteTarget = !keepFiles
      ? resolveUninstallDirectoryTarget({
          pluginId,
          hasInstall,
          installRecord: install
        })
      : null;

    if (deleteTarget) {
      preview.push(`directory: ${deleteTarget}`);
    }

    const pluginName = plugin?.name || pluginId;
    const pluginTitle = pluginName !== pluginId ? `${pluginName} (${pluginId})` : pluginName;
    console.log(`Plugin: ${pluginTitle}`);
    console.log(`Will remove: ${preview.length > 0 ? preview.join(", ") : "(nothing)"}`);

    if (opts.dryRun) {
      console.log("Dry run, no changes made.");
      return;
    }

    if (!opts.force) {
      const confirmed = await this.confirmYesNo(`Uninstall plugin "${pluginId}"?`);
      if (!confirmed) {
        console.log("Cancelled.");
        return;
      }
    }

    const result = await uninstallPlugin({
      config,
      pluginId,
      deleteFiles: !keepFiles
    });

    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }

    for (const warning of result.warnings) {
      console.warn(warning);
    }

    saveConfig(result.config);

    const removed: string[] = [];
    if (result.actions.entry) {
      removed.push("config entry");
    }
    if (result.actions.install) {
      removed.push("install record");
    }
    if (result.actions.allowlist) {
      removed.push("allowlist");
    }
    if (result.actions.loadPath) {
      removed.push("load path");
    }
    if (result.actions.directory) {
      removed.push("directory");
    }

    console.log(`Uninstalled plugin "${pluginId}". Removed: ${removed.length > 0 ? removed.join(", ") : "nothing"}.`);
    await this.requestRestart({
      reason: `plugin uninstalled: ${pluginId}`,
      manualMessage: "Restart the gateway to apply changes."
    });
  }

  async pluginsInstall(pathOrSpec: string, opts: PluginsInstallOptions = {}): Promise<void> {
    const fileSpec = this.resolveFileNpmSpecToLocalPath(pathOrSpec);
    if (fileSpec && !fileSpec.ok) {
      console.error(fileSpec.error);
      process.exit(1);
    }
    const normalized = fileSpec && fileSpec.ok ? fileSpec.path : pathOrSpec;
    const resolved = resolve(expandHome(normalized));
    const config = loadConfig();

    if (existsSync(resolved)) {
      if (opts.link) {
        const probe = await installPluginFromPath({ path: resolved, dryRun: true });
        if (!probe.ok) {
          console.error(probe.error);
          process.exit(1);
        }

        let next = addPluginLoadPath(config, resolved);
        next = enablePluginInConfig(next, probe.pluginId);
        next = recordPluginInstall(next, {
          pluginId: probe.pluginId,
          source: "path",
          sourcePath: resolved,
          installPath: resolved,
          version: probe.version
        });

        saveConfig(next);
        console.log(`Linked plugin path: ${resolved}`);
        await this.requestRestart({
          reason: `plugin linked: ${probe.pluginId}`,
          manualMessage: "Restart the gateway to load plugins."
        });
        return;
      }

      const result = await installPluginFromPath({
        path: resolved,
        logger: {
          info: (message) => console.log(message),
          warn: (message) => console.warn(message)
        }
      });

      if (!result.ok) {
        console.error(result.error);
        process.exit(1);
      }

      let next = enablePluginInConfig(config, result.pluginId);
      next = recordPluginInstall(next, {
        pluginId: result.pluginId,
        source: this.isArchivePath(resolved) ? "archive" : "path",
        sourcePath: resolved,
        installPath: result.targetDir,
        version: result.version
      });
      saveConfig(next);
      console.log(`Installed plugin: ${result.pluginId}`);
      await this.requestRestart({
        reason: `plugin installed: ${result.pluginId}`,
        manualMessage: "Restart the gateway to load plugins."
      });
      return;
    }

    if (opts.link) {
      console.error("`--link` requires a local path.");
      process.exit(1);
    }

    if (this.looksLikePath(pathOrSpec)) {
      console.error(`Path not found: ${resolved}`);
      process.exit(1);
    }

    const result = await installPluginFromNpmSpec({
      spec: pathOrSpec,
      logger: {
        info: (message) => console.log(message),
        warn: (message) => console.warn(message)
      }
    });

    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }

    let next = enablePluginInConfig(config, result.pluginId);
    next = recordPluginInstall(next, {
      pluginId: result.pluginId,
      source: "npm",
      spec: pathOrSpec,
      installPath: result.targetDir,
      version: result.version
    });
    saveConfig(next);
    console.log(`Installed plugin: ${result.pluginId}`);
    await this.requestRestart({
      reason: `plugin installed: ${result.pluginId}`,
      manualMessage: "Restart the gateway to load plugins."
    });
  }

  pluginsDoctor(): void {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: Object.keys(config.channels),
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
    });

    const pluginErrors = report.plugins.filter((plugin) => plugin.status === "error");
    const diagnostics = report.diagnostics.filter((diag) => diag.level === "error");

    if (pluginErrors.length === 0 && diagnostics.length === 0) {
      console.log("No plugin issues detected.");
      return;
    }

    if (pluginErrors.length > 0) {
      console.log("Plugin errors:");
      for (const entry of pluginErrors) {
        console.log(`- ${entry.id}: ${entry.error ?? "failed to load"} (${entry.source})`);
      }
    }

    if (diagnostics.length > 0) {
      if (pluginErrors.length > 0) {
        console.log("");
      }
      console.log("Diagnostics:");
      for (const diag of diagnostics) {
        const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
        console.log(`- ${prefix}${diag.message}`);
      }
    }
  }

  async skillsInstall(options: {
    slug: string;
    version?: string;
    registry?: string;
    workdir?: string;
    dir?: string;
    force?: boolean;
  }): Promise<void> {
    const workdir = options.workdir ? expandHome(options.workdir) : getWorkspacePath();
    const result = await installClawHubSkill({
      slug: options.slug,
      version: options.version,
      registry: options.registry,
      workdir,
      dir: options.dir,
      force: options.force
    });

    const versionLabel = result.version ?? "latest";
    if (result.alreadyInstalled) {
      console.log(`✓ ${result.slug} is already installed`);
    } else {
      console.log(`✓ Installed ${result.slug}@${versionLabel}`);
    }
    if (result.registry) {
      console.log(`  Registry: ${result.registry}`);
    }
    console.log(`  Path: ${result.destinationDir}`);
  }

  channelsStatus(): void {
    const config = loadConfig();
    console.log("Channel Status");
    console.log(`WhatsApp: ${config.channels.whatsapp.enabled ? "✓" : "✗"}`);
    console.log(`Discord: ${config.channels.discord.enabled ? "✓" : "✗"}`);
    console.log(`Feishu: ${config.channels.feishu.enabled ? "✓" : "✗"}`);
    console.log(`Mochat: ${config.channels.mochat.enabled ? "✓" : "✗"}`);
    console.log(`Telegram: ${config.channels.telegram.enabled ? "✓" : "✗"}`);
    console.log(`Slack: ${config.channels.slack.enabled ? "✓" : "✗"}`);
    console.log(`QQ: ${config.channels.qq.enabled ? "✓" : "✗"}`);

    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: Object.keys(config.channels),
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
    });

    const pluginChannels = report.plugins.filter((plugin) => plugin.status === "loaded" && plugin.channelIds.length > 0);
    if (pluginChannels.length > 0) {
      console.log("Plugin Channels:");
      for (const plugin of pluginChannels) {
        const channels = plugin.channelIds.join(", ");
        console.log(`- ${channels} (plugin: ${plugin.id})`);
      }
    }
  }

  channelsLogin(): void {
    const bridgeDir = this.getBridgeDir();
    console.log(`${this.logo} Starting bridge...`);
    console.log("Scan the QR code to connect.\n");
    const result = spawnSync("npm", ["start"], { cwd: bridgeDir, stdio: "inherit" });
    if (result.status !== 0) {
      console.error(`Bridge failed: ${result.status ?? 1}`);
    }
  }

  async channelsAdd(opts: ChannelsAddOptions): Promise<void> {
    const channelId = opts.channel?.trim();
    if (!channelId) {
      console.error("--channel is required");
      process.exit(1);
    }

    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const pluginRegistry = this.loadPluginRegistry(config, workspaceDir);
    const bindings = getPluginChannelBindings(pluginRegistry);

    const binding = bindings.find((entry) => entry.channelId === channelId || entry.pluginId === channelId);
    if (!binding) {
      console.error(`No plugin channel found for: ${channelId}`);
      process.exit(1);
    }

    const setup = binding.channel.setup;
    if (!setup?.applyAccountConfig) {
      console.error(`Channel "${binding.channelId}" does not support setup.`);
      process.exit(1);
    }

    const input = {
      name: opts.name,
      token: opts.token,
      code: opts.code,
      url: opts.url,
      httpUrl: opts.httpUrl
    };

    const currentView = this.toPluginConfigView(config, bindings);
    const accountId = binding.channel.config?.defaultAccountId?.(currentView) ?? "default";

    const validateError = setup.validateInput?.({
      cfg: currentView,
      input,
      accountId
    });
    if (validateError) {
      console.error(`Channel setup validation failed: ${validateError}`);
      process.exit(1);
    }

    const nextView = setup.applyAccountConfig({
      cfg: currentView,
      input,
      accountId
    });

    if (!nextView || typeof nextView !== "object" || Array.isArray(nextView)) {
      console.error("Channel setup returned invalid config payload.");
      process.exit(1);
    }

    let next = this.mergePluginConfigView(config, nextView as Record<string, unknown>, bindings);
    next = enablePluginInConfig(next, binding.pluginId);
    saveConfig(next);

    console.log(`Configured channel "${binding.channelId}" via plugin "${binding.pluginId}".`);
    await this.requestRestart({
      reason: `channel configured via plugin: ${binding.pluginId}`,
      manualMessage: "Restart the gateway to apply changes."
    });
  }

  private toPluginConfigView(config: Config, bindings: PluginChannelBinding[]): Record<string, unknown> {
    const view = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
    const channels =
      view.channels && typeof view.channels === "object" && !Array.isArray(view.channels)
        ? ({ ...(view.channels as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    for (const binding of bindings) {
      const pluginConfig = config.plugins.entries?.[binding.pluginId]?.config;
      if (!pluginConfig || typeof pluginConfig !== "object" || Array.isArray(pluginConfig)) {
        continue;
      }
      channels[binding.channelId] = JSON.parse(JSON.stringify(pluginConfig)) as Record<string, unknown>;
    }

    view.channels = channels;
    return view;
  }

  private mergePluginConfigView(
    baseConfig: Config,
    pluginViewConfig: Record<string, unknown>,
    bindings: PluginChannelBinding[]
  ): Config {
    const next = JSON.parse(JSON.stringify(baseConfig)) as Config;
    const pluginChannels =
      pluginViewConfig.channels && typeof pluginViewConfig.channels === "object" && !Array.isArray(pluginViewConfig.channels)
        ? (pluginViewConfig.channels as Record<string, unknown>)
        : {};

    const entries = { ...(next.plugins.entries ?? {}) };

    for (const binding of bindings) {
      if (!Object.prototype.hasOwnProperty.call(pluginChannels, binding.channelId)) {
        continue;
      }

      const channelConfig = pluginChannels[binding.channelId];
      if (!channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
        continue;
      }

      entries[binding.pluginId] = {
        ...(entries[binding.pluginId] ?? {}),
        config: channelConfig as Record<string, unknown>
      };
    }

    next.plugins = {
      ...next.plugins,
      entries
    };

    return next;
  }

  cronList(opts: { all?: boolean }): void {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    const jobs = service.listJobs(Boolean(opts.all));
    if (!jobs.length) {
      console.log("No scheduled jobs.");
      return;
    }
    for (const job of jobs) {
      let schedule = "";
      if (job.schedule.kind === "every") {
        schedule = `every ${Math.round((job.schedule.everyMs ?? 0) / 1000)}s`;
      } else if (job.schedule.kind === "cron") {
        schedule = job.schedule.expr ?? "";
      } else {
        schedule = job.schedule.atMs ? new Date(job.schedule.atMs).toISOString() : "";
      }
      console.log(`${job.id} ${job.name} ${schedule}`);
    }
  }

  cronAdd(opts: CronAddOptions): void {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    let schedule: { kind: "every" | "cron" | "at"; everyMs?: number; expr?: string; atMs?: number } | null = null;
    if (opts.every) {
      schedule = { kind: "every", everyMs: Number(opts.every) * 1000 };
    } else if (opts.cron) {
      schedule = { kind: "cron", expr: String(opts.cron) };
    } else if (opts.at) {
      schedule = { kind: "at", atMs: Date.parse(String(opts.at)) };
    }
    if (!schedule) {
      console.error("Error: Must specify --every, --cron, or --at");
      return;
    }
    const job = service.addJob({
      name: opts.name,
      schedule,
      message: opts.message,
      deliver: Boolean(opts.deliver),
      channel: opts.channel,
      to: opts.to
    });
    console.log(`✓ Added job '${job.name}' (${job.id})`);
  }

  cronRemove(jobId: string): void {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    if (service.removeJob(jobId)) {
      console.log(`✓ Removed job ${jobId}`);
    } else {
      console.log(`Job ${jobId} not found`);
    }
  }

  cronEnable(jobId: string, opts: { disable?: boolean }): void {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    const job = service.enableJob(jobId, !opts.disable);
    if (job) {
      console.log(`✓ Job '${job.name}' ${opts.disable ? "disabled" : "enabled"}`);
    } else {
      console.log(`Job ${jobId} not found`);
    }
  }

  async cronRun(jobId: string, opts: { force?: boolean }): Promise<void> {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    const ok = await service.runJob(jobId, Boolean(opts.force));
    console.log(ok ? "✓ Job executed" : `Failed to run job ${jobId}`);
  }

  status(): void {
    const configPath = getConfigPath();
    const config = loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    console.log(`${this.logo} ${APP_NAME} Status\n`);
    console.log(`Config: ${configPath} ${existsSync(configPath) ? "✓" : "✗"}`);
    console.log(`Workspace: ${workspace} ${existsSync(workspace) ? "✓" : "✗"}`);
    console.log(`Model: ${config.agents.defaults.model}`);
    for (const spec of PROVIDERS) {
      const provider = (config.providers as Record<string, { apiKey?: string; apiBase?: string }>)[spec.name];
      if (!provider) {
        continue;
      }
      if (spec.isLocal) {
        console.log(`${spec.displayName ?? spec.name}: ${provider.apiBase ? `✓ ${provider.apiBase}` : "not set"}`);
      } else {
        console.log(`${spec.displayName ?? spec.name}: ${provider.apiKey ? "✓" : "not set"}`);
      }
    }
  }

  private loadPluginRegistry(config: Config, workspaceDir: string): PluginRegistry {
    return loadOpenClawPlugins({
      config,
      workspaceDir,
      reservedToolNames: [
        "read_file",
        "write_file",
        "edit_file",
        "list_dir",
        "exec",
        "web_search",
        "web_fetch",
        "message",
        "spawn",
        "sessions_list",
        "sessions_history",
        "sessions_send",
        "memory_search",
        "memory_get",
        "subagents",
        "gateway",
        "cron"
      ],
      reservedChannelIds: Object.keys(config.channels),
      reservedProviderIds: PROVIDERS.map((provider) => provider.name),
      logger: {
        info: (message) => console.log(message),
        warn: (message) => console.warn(message),
        error: (message) => console.error(message),
        debug: (message) => console.debug(message)
      }
    });
  }

  private toExtensionRegistry(pluginRegistry: PluginRegistry): ExtensionRegistry {
    return {
      tools: pluginRegistry.tools.map((tool) => ({
        extensionId: tool.pluginId,
        factory: tool.factory,
        names: tool.names,
        optional: tool.optional,
        source: tool.source
      })),
      channels: pluginRegistry.channels.map((channel) => ({
        extensionId: channel.pluginId,
        channel: channel.channel,
        source: channel.source
      })),
      diagnostics: pluginRegistry.diagnostics.map((diag) => ({
        level: diag.level,
        message: diag.message,
        extensionId: diag.pluginId,
        source: diag.source
      }))
    };
  }

  private logPluginDiagnostics(registry: PluginRegistry): void {
    for (const diag of registry.diagnostics) {
      const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
      const text = `${prefix}${diag.message}`;
      if (diag.level === "error") {
        console.error(`[plugins] ${text}`);
      } else {
        console.warn(`[plugins] ${text}`);
      }
    }
  }

  private async startGateway(
    options: { uiOverrides?: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string | null } = {}
  ): Promise<void> {
    const config = loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    const pluginRegistry = this.loadPluginRegistry(config, workspace);
    const extensionRegistry = this.toExtensionRegistry(pluginRegistry);
    this.logPluginDiagnostics(pluginRegistry);

    const bus = new MessageBus();
    const provider =
      options.allowMissingProvider === true ? this.makeProvider(config, { allowMissing: true }) : this.makeProvider(config);
    const providerManager = new ProviderManager(provider ?? this.makeMissingProvider(config));
    const sessionManager = new SessionManager(workspace);

    const cronStorePath = join(getDataDir(), "cron", "jobs.json");
    const cron = new CronService(cronStorePath);

    const pluginUiMetadata = getPluginUiMetadataFromRegistry(pluginRegistry);
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiStaticDir = options.uiStaticDir === undefined ? resolveUiStaticDir() : options.uiStaticDir;
    if (!provider) {
      console.warn("Warning: No API key configured. The gateway is running, but agent replies are disabled until provider config is set.");
    }

    const channels = new ChannelManager(config, bus, sessionManager, extensionRegistry.channels);
    const reloader = new ConfigReloader({
      initialConfig: config,
      channels,
      bus,
      sessionManager,
      providerManager,
      makeProvider: (nextConfig) => this.makeProvider(nextConfig, { allowMissing: true }) ?? this.makeMissingProvider(nextConfig),
      loadConfig,
      getExtensionChannels: () => extensionRegistry.channels,
      onRestartRequired: (paths) => {
        void this.requestRestart({
          reason: `config reload requires restart: ${paths.join(", ")}`,
          manualMessage: `Config changes require restart: ${paths.join(", ")}`,
          strategy: "background-service-or-manual"
        });
      }
    });
    const gatewayController = new GatewayControllerImpl({
      reloader,
      cron,
      getConfigPath,
      saveConfig,
      getPluginUiMetadata: () => pluginUiMetadata,
      requestRestart: async (options) => {
        await this.requestRestart({
          reason: options?.reason ?? "gateway tool restart",
          manualMessage: "Restart the gateway to apply changes.",
          strategy: "background-service-or-exit",
          delayMs: options?.delayMs,
          silentOnServiceRestart: true
        });
      }
    });

    const agent = new AgentLoop({
      bus,
      providerManager,
      workspace,
      model: config.agents.defaults.model,
      maxIterations: config.agents.defaults.maxToolIterations,
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      cronService: cron,
      restrictToWorkspace: config.tools.restrictToWorkspace,
      sessionManager,
      contextConfig: config.agents.context,
      gatewayController,
      config,
      extensionRegistry,
      resolveMessageToolHints: ({ channel, accountId }) =>
        resolvePluginChannelMessageToolHints({
          registry: pluginRegistry,
          channel,
          cfg: loadConfig(),
          accountId
        })
    });

    reloader.setApplyAgentRuntimeConfig((nextConfig) => agent.applyRuntimeConfig(nextConfig));

    const pluginChannelBindings = getPluginChannelBindings(pluginRegistry);
    setPluginRuntimeBridge({
      loadConfig: () => this.toPluginConfigView(loadConfig(), pluginChannelBindings),
      writeConfigFile: async (nextConfigView) => {
        if (!nextConfigView || typeof nextConfigView !== "object" || Array.isArray(nextConfigView)) {
          throw new Error("plugin runtime writeConfigFile expects an object config");
        }
        const current = loadConfig();
        const next = this.mergePluginConfigView(current, nextConfigView, pluginChannelBindings);
        saveConfig(next);
      },
      dispatchReplyWithBufferedBlockDispatcher: async ({ ctx, dispatcherOptions }) => {
        const bodyForAgent = typeof ctx.BodyForAgent === "string" ? ctx.BodyForAgent : "";
        const body = typeof ctx.Body === "string" ? ctx.Body : "";
        const content = (bodyForAgent || body).trim();
        if (!content) {
          return;
        }

        const sessionKey =
          typeof ctx.SessionKey === "string" && ctx.SessionKey.trim().length > 0
            ? ctx.SessionKey
            : `plugin:${typeof ctx.OriginatingChannel === "string" ? ctx.OriginatingChannel : "channel"}:${typeof ctx.SenderId === "string" ? ctx.SenderId : "unknown"}`;
        const channel =
          typeof ctx.OriginatingChannel === "string" && ctx.OriginatingChannel.trim().length > 0
            ? ctx.OriginatingChannel
            : "cli";
        const chatId =
          typeof ctx.OriginatingTo === "string" && ctx.OriginatingTo.trim().length > 0
            ? ctx.OriginatingTo
            : typeof ctx.SenderId === "string" && ctx.SenderId.trim().length > 0
              ? ctx.SenderId
              : "direct";

        try {
          const response = await agent.processDirect({
            content,
            sessionKey,
            channel,
            chatId,
            metadata:
              typeof ctx.AccountId === "string" && ctx.AccountId.trim().length > 0
                ? { account_id: ctx.AccountId }
                : {}
          });
          const replyText = typeof response === "string" ? response : String(response ?? "");
          if (replyText.trim()) {
            await dispatcherOptions.deliver({ text: replyText }, { kind: "final" });
          }
        } catch (error) {
          dispatcherOptions.onError?.(error);
          throw error;
        }
      }
    });

    cron.onJob = async (job) => {
      const response = await agent.processDirect({
        content: job.payload.message,
        sessionKey: `cron:${job.id}`,
        channel: job.payload.channel ?? "cli",
        chatId: job.payload.to ?? "direct"
      });
      if (job.payload.deliver && job.payload.to) {
        await bus.publishOutbound({
          channel: job.payload.channel ?? "cli",
          chatId: job.payload.to,
          content: response,
          media: [],
          metadata: {}
        });
      }
      return response;
    };

    const heartbeat = new HeartbeatService(
      workspace,
      async (promptText) => agent.processDirect({ content: promptText, sessionKey: "heartbeat" }),
      30 * 60,
      true
    );
    if (reloader.getChannels().enabledChannels.length) {
      console.log(`✓ Channels enabled: ${reloader.getChannels().enabledChannels.join(", ")}`);
    } else {
      console.log("Warning: No channels enabled");
    }

    this.startUiIfEnabled(uiConfig, uiStaticDir);

    const cronStatus = cron.status();
    if (cronStatus.jobs > 0) {
      console.log(`✓ Cron: ${cronStatus.jobs} scheduled jobs`);
    }
    console.log("✓ Heartbeat: every 30m");

    const configPath = getConfigPath();
    const watcher = chokidar.watch(configPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
    });
    watcher.on("add", () => reloader.scheduleReload("config add"));
    watcher.on("change", () => reloader.scheduleReload("config change"));
    watcher.on("unlink", () => reloader.scheduleReload("config unlink"));

    await cron.start();
    await heartbeat.start();

    let pluginGatewayHandles: Awaited<ReturnType<typeof startPluginChannelGateways>>["handles"] = [];
    try {
      const startedPluginGateways = await startPluginChannelGateways({
        registry: pluginRegistry,
        logger: {
          info: (message) => console.log(`[plugins] ${message}`),
          warn: (message) => console.warn(`[plugins] ${message}`),
          error: (message) => console.error(`[plugins] ${message}`),
          debug: (message) => console.debug(`[plugins] ${message}`)
        }
      });
      pluginGatewayHandles = startedPluginGateways.handles;
      for (const diag of startedPluginGateways.diagnostics) {
        const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
        const text = `${prefix}${diag.message}`;
        if (diag.level === "error") {
          console.error(`[plugins] ${text}`);
        } else {
          console.warn(`[plugins] ${text}`);
        }
      }

      await Promise.allSettled([agent.run(), reloader.getChannels().startAll()]);
    } finally {
      await stopPluginChannelGateways(pluginGatewayHandles);
      setPluginRuntimeBridge(null);
    }
  }

  private async printPublicUiUrls(host: string, port: number): Promise<void> {
    if (isLoopbackHost(host)) {
      console.log('Public URL: disabled (UI host is loopback). Use "--public" or "--ui-host 0.0.0.0" to expose it.');
      return;
    }

    const publicIp = await resolvePublicIp();
    if (!publicIp) {
      console.log("Public URL: UI is exposed, but automatic public IP detection failed.");
      return;
    }

    const publicBase = `http://${publicIp}:${port}`;
    console.log(`Public UI (if firewall/NAT allows): ${publicBase}`);
    console.log(`Public API (if firewall/NAT allows): ${publicBase}/api`);
  }

  private startUiIfEnabled(uiConfig: Config["ui"], uiStaticDir: string | null): void {
    if (!uiConfig.enabled) {
      return;
    }
    const uiServer = startUiServer({
      host: uiConfig.host,
      port: uiConfig.port,
      configPath: getConfigPath(),
      staticDir: uiStaticDir ?? undefined
    });
    const uiUrl = `http://${uiServer.host}:${uiServer.port}`;
    console.log(`✓ UI API: ${uiUrl}/api`);
    if (uiStaticDir) {
      console.log(`✓ UI frontend: ${uiUrl}`);
    }
    void this.printPublicUiUrls(uiServer.host, uiServer.port);
    if (uiConfig.open) {
      openBrowser(uiUrl);
    }
  }

  private async runForeground(options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
  }): Promise<void> {
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);

    if (options.open) {
      openBrowser(uiUrl);
    }

    await this.startGateway({
      uiOverrides: options.uiOverrides,
      allowMissingProvider: true,
      uiStaticDir: resolveUiStaticDir()
    });
  }

  private async startService(options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
  }): Promise<void> {
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);
    const apiUrl = `${uiUrl}/api`;
    const staticDir = resolveUiStaticDir();

    const existing = readServiceState();
    if (existing && isProcessRunning(existing.pid)) {
      console.log(`✓ ${APP_NAME} is already running (PID ${existing.pid})`);
      console.log(`UI: ${existing.uiUrl}`);
      console.log(`API: ${existing.apiUrl}`);

      const parsedUi = (() => {
        try {
          const parsed = new URL(existing.uiUrl);
          const port = Number(parsed.port || 80);
          return {
            host: existing.uiHost ?? parsed.hostname,
            port: Number.isFinite(port) ? port : existing.uiPort ?? 18791
          };
        } catch {
          return {
            host: existing.uiHost ?? "127.0.0.1",
            port: existing.uiPort ?? 18791
          };
        }
      })();

      await this.printPublicUiUrls(parsedUi.host, parsedUi.port);
      if (parsedUi.host !== uiConfig.host || parsedUi.port !== uiConfig.port) {
        console.log(
          `Note: requested UI bind (${uiConfig.host}:${uiConfig.port}) differs from running service (${parsedUi.host}:${parsedUi.port}).`
        );
        console.log(`Run: ${APP_NAME} restart${uiConfig.host === "0.0.0.0" ? " --public" : ""}`);
      }

      console.log(`Logs: ${existing.logPath}`);
      console.log(`Stop: ${APP_NAME} stop`);
      return;
    }
    if (existing) {
      clearServiceState();
    }

    if (!staticDir) {
      console.log("Warning: UI frontend not found in package assets.");
    }

    const logPath = resolveServiceLogPath();
    const logDir = resolve(logPath, "..");
    mkdirSync(logDir, { recursive: true });
    const logFd = openSync(logPath, "a");

    const serveArgs = buildServeArgs({
      uiHost: uiConfig.host,
      uiPort: uiConfig.port,
    });
    const child = spawn(process.execPath, [...process.execArgv, ...serveArgs], {
      env: process.env,
      stdio: ["ignore", logFd, logFd],
      detached: true
    });
    closeSync(logFd);
    if (!child.pid) {
      console.error("Error: Failed to start background service.");
      return;
    }
    child.unref();

    const state: ServiceState = {
      pid: child.pid,
      startedAt: new Date().toISOString(),
      uiUrl,
      apiUrl,
      uiHost: uiConfig.host,
      uiPort: uiConfig.port,
      logPath
    };
    writeServiceState(state);

    console.log(`✓ ${APP_NAME} started in background (PID ${state.pid})`);
    console.log(`UI: ${uiUrl}`);
    console.log(`API: ${apiUrl}`);
    await this.printPublicUiUrls(uiConfig.host, uiConfig.port);
    console.log(`Logs: ${logPath}`);
    console.log(`Stop: ${APP_NAME} stop`);

    if (options.open) {
      openBrowser(uiUrl);
    }
  }

  private async stopService(): Promise<void> {
    const state = readServiceState();
    if (!state) {
      console.log("No running service found.");
      return;
    }
    if (!isProcessRunning(state.pid)) {
      console.log("Service is not running. Cleaning up state.");
      clearServiceState();
      return;
    }

    console.log(`Stopping ${APP_NAME} (PID ${state.pid})...`);
    try {
      process.kill(state.pid, "SIGTERM");
    } catch (error) {
      console.error(`Failed to stop service: ${String(error)}`);
      return;
    }

    const stopped = await waitForExit(state.pid, 3000);
    if (!stopped) {
      try {
        process.kill(state.pid, "SIGKILL");
      } catch (error) {
        console.error(`Failed to force stop service: ${String(error)}`);
        return;
      }
      await waitForExit(state.pid, 2000);
    }

    clearServiceState();
    console.log(`✓ ${APP_NAME} stopped`);
  }

  private async confirmYesNo(question: string): Promise<boolean> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(`${question} [y/N] `, (line) => resolve(line));
    });

    rl.close();
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  }

  private makeMissingProvider(config: ReturnType<typeof loadConfig>): LLMProvider {
    return new MissingProvider(config.agents.defaults.model);
  }

  private makeProvider(config: ReturnType<typeof loadConfig>, options: { allowMissing: true }): LiteLLMProvider | null;
  private makeProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: false }): LiteLLMProvider;
  private makeProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: boolean }) {
    const provider = getProvider(config);
    const model = config.agents.defaults.model;
    if (!provider?.apiKey && !model.startsWith("bedrock/")) {
      if (options?.allowMissing) {
        return null;
      }
      console.error("Error: No API key configured.");
      console.error(`Set one in ${getConfigPath()} under providers section`);
      process.exit(1);
    }
    return new LiteLLMProvider({
      apiKey: provider?.apiKey ?? null,
      apiBase: getApiBase(config),
      defaultModel: model,
      extraHeaders: provider?.extraHeaders ?? null,
      providerName: getProviderName(config),
      wireApi: provider?.wireApi ?? null
    });
  }

  private resolveFileNpmSpecToLocalPath(
    raw: string
  ): { ok: true; path: string } | { ok: false; error: string } | null {
    const trimmed = raw.trim();
    if (!trimmed.toLowerCase().startsWith("file:")) {
      return null;
    }
    const rest = trimmed.slice("file:".length);
    if (!rest) {
      return { ok: false, error: "unsupported file: spec: missing path" };
    }
    if (rest.startsWith("///")) {
      return { ok: true, path: rest.slice(2) };
    }
    if (rest.startsWith("//localhost/")) {
      return { ok: true, path: rest.slice("//localhost".length) };
    }
    if (rest.startsWith("//")) {
      return {
        ok: false,
        error: 'unsupported file: URL host (expected "file:<path>" or "file:///abs/path")'
      };
    }
    return { ok: true, path: rest };
  }

  private looksLikePath(raw: string): boolean {
    return (
      raw.startsWith(".") ||
      raw.startsWith("~") ||
      raw.startsWith("/") ||
      raw.endsWith(".ts") ||
      raw.endsWith(".js") ||
      raw.endsWith(".mjs") ||
      raw.endsWith(".cjs") ||
      raw.endsWith(".tgz") ||
      raw.endsWith(".tar.gz") ||
      raw.endsWith(".tar") ||
      raw.endsWith(".zip")
    );
  }

  private isArchivePath(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return lower.endsWith(".zip") || lower.endsWith(".tgz") || lower.endsWith(".tar.gz") || lower.endsWith(".tar");
  }

  private createWorkspaceTemplates(workspace: string, options: { force?: boolean } = {}): { created: string[] } {
    const created: string[] = [];
    const force = Boolean(options.force);
    const templateDir = this.resolveTemplateDir();
    if (!templateDir) {
      console.warn("Warning: Template directory not found. Skipping workspace templates.");
      return { created };
    }
    const templateFiles = [
      { source: "AGENTS.md", target: "AGENTS.md" },
      { source: "SOUL.md", target: "SOUL.md" },
      { source: "USER.md", target: "USER.md" },
      { source: "IDENTITY.md", target: "IDENTITY.md" },
      { source: "TOOLS.md", target: "TOOLS.md" },
      { source: "BOOT.md", target: "BOOT.md" },
      { source: "BOOTSTRAP.md", target: "BOOTSTRAP.md" },
      { source: "HEARTBEAT.md", target: "HEARTBEAT.md" },
      { source: "MEMORY.md", target: "MEMORY.md" },
      { source: "memory/MEMORY.md", target: "memory/MEMORY.md" }
    ];

    for (const entry of templateFiles) {
      const filePath = join(workspace, entry.target);
      if (!force && existsSync(filePath)) {
        continue;
      }
      const templatePath = join(templateDir, entry.source);
      if (!existsSync(templatePath)) {
        console.warn(`Warning: Template file missing: ${templatePath}`);
        continue;
      }
      const raw = readFileSync(templatePath, "utf-8");
      const content = raw.replace(/\$\{APP_NAME\}/g, APP_NAME);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content);
      created.push(entry.target);
    }

    const memoryDir = join(workspace, "memory");
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
      created.push(join("memory", ""));
    }

    const skillsDir = join(workspace, "skills");
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
      created.push(join("skills", ""));
    }
    const seeded = this.seedBuiltinSkills(skillsDir, { force });
    if (seeded > 0) {
      created.push(`skills (seeded ${seeded} built-ins)`);
    }
    return { created };
  }

  private seedBuiltinSkills(targetDir: string, options: { force?: boolean } = {}): number {
    const sourceDir = this.resolveBuiltinSkillsDir();
    if (!sourceDir) {
      return 0;
    }
    const force = Boolean(options.force);
    const existing = readdirSync(targetDir, { withFileTypes: true }).filter((entry) => !entry.name.startsWith("."));
    if (!force && existing.length > 0) {
      return 0;
    }
    let seeded = 0;
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const src = join(sourceDir, entry.name);
      if (!existsSync(join(src, "SKILL.md"))) {
        continue;
      }
      const dest = join(targetDir, entry.name);
      if (!force && existsSync(dest)) {
        continue;
      }
      cpSync(src, dest, { recursive: true, force: true });
      seeded += 1;
    }
    return seeded;
  }

  private resolveBuiltinSkillsDir(): string | null {
    try {
      const require = createRequire(import.meta.url);
      const entry = require.resolve("@nextclaw/core");
      const pkgRoot = resolve(dirname(entry), "..");
      const distSkills = join(pkgRoot, "dist", "skills");
      if (existsSync(distSkills)) {
        return distSkills;
      }
      const srcSkills = join(pkgRoot, "src", "agent", "skills");
      if (existsSync(srcSkills)) {
        return srcSkills;
      }
      return null;
    } catch {
      return null;
    }
  }

  private resolveTemplateDir(): string | null {
    const override = process.env.NEXTCLAW_TEMPLATE_DIR?.trim();
    if (override) {
      return override;
    }
    const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
    const pkgRoot = resolve(cliDir, "..", "..");
    const candidates = [join(pkgRoot, "templates")];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private getBridgeDir(): string {
    const userBridge = join(getDataDir(), "bridge");
    if (existsSync(join(userBridge, "dist", "index.js"))) {
      return userBridge;
    }

    if (!which("npm")) {
      console.error("npm not found. Please install Node.js >= 18.");
      process.exit(1);
    }

    const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
    const pkgRoot = resolve(cliDir, "..", "..");
    const pkgBridge = join(pkgRoot, "bridge");
    const srcBridge = join(pkgRoot, "..", "..", "bridge");

    let source: string | null = null;
    if (existsSync(join(pkgBridge, "package.json"))) {
      source = pkgBridge;
    } else if (existsSync(join(srcBridge, "package.json"))) {
      source = srcBridge;
    }

    if (!source) {
      console.error(`Bridge source not found. Try reinstalling ${APP_NAME}.`);
      process.exit(1);
    }

    console.log(`${this.logo} Setting up bridge...`);
    mkdirSync(resolve(userBridge, ".."), { recursive: true });
    if (existsSync(userBridge)) {
      rmSync(userBridge, { recursive: true, force: true });
    }
    cpSync(source, userBridge, {
      recursive: true,
      filter: (src) => !src.includes("node_modules") && !src.includes("dist")
    });

    const install = spawnSync("npm", ["install"], { cwd: userBridge, stdio: "pipe" });
    if (install.status !== 0) {
      console.error(`Bridge install failed: ${install.status ?? 1}`);
      if (install.stderr) {
        console.error(String(install.stderr).slice(0, 500));
      }
      process.exit(1);
    }

    const build = spawnSync("npm", ["run", "build"], { cwd: userBridge, stdio: "pipe" });
    if (build.status !== 0) {
      console.error(`Bridge build failed: ${build.status ?? 1}`);
      if (build.stderr) {
        console.error(String(build.stderr).slice(0, 500));
      }
      process.exit(1);
    }

    console.log("✓ Bridge ready\n");
    return userBridge;
  }
}
