import { APP_NAME, getConfigPath, getDataDir, loadConfig, resolveWorkspacePath } from "@nextclaw/core";
import { NextclawKernel } from "@nextclaw/kernel";
import { existsSync, mkdirSync } from "node:fs";
import { ManagedServiceManager } from "@nextclaw-service/managers/managed-service.manager.js";
import { ServiceCommandManager, runCliAgentCommand, type NextclawServiceCommands } from "@nextclaw-service/managers/service-command.manager.js";
import { ServiceRestartManager } from "@nextclaw-service/managers/service-restart.manager.js";
import { ServiceWorkspaceManager } from "@nextclaw-service/managers/service-workspace.manager.js";
import { NpmRuntimeLauncher } from "@nextclaw-service/launcher/npm-runtime-launcher.service.js";
import { NpmRuntimeUpdateCommandService } from "@nextclaw-service/services/runtime/npm-runtime-update-command.service.js";
import { initializeConfigIfMissing } from "@nextclaw-service/services/runtime/runtime-config-init.service.js";
import { NextclawDistributionService } from "@nextclaw-service/services/runtime/nextclaw-distribution.service.js";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";
import type { AgentCommandOptions, LoginCommandOptions, UpdateCommandOptions } from "@nextclaw-service/types/cli.types.js";
import { isProcessRunning } from "@nextclaw-service/utils/cli.utils.js";
import { logStartupTrace } from "@nextclaw-service/utils/startup-trace.utils.js";

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

export class NextclawServiceRuntime {
  private readonly logo: string;
  private readonly workspaceManager: ServiceWorkspaceManager;
  private readonly managedServiceManager: ManagedServiceManager;
  private readonly restartManager: ServiceRestartManager;
  private readonly commandManager: ServiceCommandManager;
  readonly account: NextclawServiceRuntimeAccount;
  readonly commands: NextclawServiceCommands;

  constructor(options: NextclawServiceRuntimeOptions) {
    logStartupTrace("cli.runtime.constructor.begin");
    this.logo = options.logo ?? "🤖";
    this.workspaceManager = new ServiceWorkspaceManager();
    this.managedServiceManager = new ManagedServiceManager({
      requestRestart: (params) => this.restartManager.requestRestart(params),
      initializeAgentHomeDirectory: (homeDirectory) => this.workspaceManager.createWorkspaceTemplates(homeDirectory)
    });
    this.restartManager = new ServiceRestartManager({
      managedService: this.managedServiceManager
    });
    this.commandManager = new ServiceCommandManager({
      logo: this.logo,
      init: (params) => this.init(params),
      managedService: this.managedServiceManager,
      restart: this.restartManager,
      workspace: this.workspaceManager
    });
    this.commands = this.commandManager.commands;
    this.account = {
      status: async (opts = {}) => {
        await this.init({ source: "account status", auto: true });
        await this.commandManager.platformAuth.accountStatus(opts);
      },
      setUsername: async (username, opts = {}) => {
        await this.init({ source: "account set-username", auto: true });
        await this.commandManager.platformAuth.accountSetUsername({
          apiBase: opts.apiBase,
          json: opts.json,
          username
        });
      },
    };
    logStartupTrace("cli.runtime.constructor.end");
  }

  get version(): string {
    return NextclawDistributionService.get().version;
  }

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
    const workspacePath = resolveWorkspacePath(config.agents.defaults.workspace);
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
    await this.commandManager.platformAuth.login(opts);
  };

  agent = async (opts: AgentCommandOptions): Promise<void> => {
    const configPath = getConfigPath();
    const kernel = new NextclawKernel({
      homeDir: getDataDir(),
      configPath,
    });
    const config = kernel.configManager.config;

    await runCliAgentCommand({
      logo: this.logo,
      opts,
      config,
      kernel,
    });
  };

  update = async (opts: UpdateCommandOptions): Promise<void> => {
    const versionBefore = this.version;
    if (!opts.json) {
      const installationLabel = process.env.NEXTCLAW_DESKTOP_COMMAND_SURFACE === "1" ? "desktop runtime" : "npm launcher";
      console.log(`Current ${installationLabel} version: ${versionBefore}`);
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
}

export const runNextclawNpmRuntimeLauncher = (
  argv: string[] = process.argv,
): void => {
  const distribution = NextclawDistributionService.get();
  new NpmRuntimeLauncher({
    argv,
    launcherVersion: distribution.version,
    packagedAppEntrypoint: distribution.appEntrypoint,
  }).run();
};
