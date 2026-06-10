import { APP_NAME } from "@nextclaw/core";
import { AgentManager } from "@nextclaw/kernel";
import { RemoteRuntimeActions } from "@nextclaw/remote";
import { AgentCommands, runCliAgentCommand } from "@nextclaw-service/controllers/commands/agent-command.controller.js";
import { ChannelCommands } from "@nextclaw-service/controllers/commands/channel-command.controller.js";
import { ConfigCommands } from "@nextclaw-service/controllers/commands/config-command.controller.js";
import { CronCommands } from "@nextclaw-service/controllers/commands/cron-command.controller.js";
import { DiagnosticsCommands } from "@nextclaw-service/controllers/commands/diagnostics-command.controller.js";
import { GatewayCommands } from "@nextclaw-service/controllers/commands/gateway-command.controller.js";
import { LogsCommands } from "@nextclaw-service/controllers/commands/logs-command.controller.js";
import { SkillsCommands } from "@nextclaw-service/controllers/commands/marketplace-skill-command.controller.js";
import { McpCommands } from "@nextclaw-service/controllers/commands/mcp-command.controller.js";
import { PlatformAuthCommands } from "@nextclaw-service/controllers/commands/platform-auth-command.controller.js";
import { RemoteCommands, hasRunningNextclawManagedService } from "@nextclaw-service/controllers/commands/remote-command.controller.js";
import { RestartCommands } from "@nextclaw-service/controllers/commands/restart-command.controller.js";
import { SecretsCommands } from "@nextclaw-service/controllers/commands/secrets-command.controller.js";
import { ServeCommands } from "@nextclaw-service/controllers/commands/serve-command.controller.js";
import { ServiceCommands } from "@nextclaw-service/controllers/commands/service-command.controller.js";
import { StartCommands } from "@nextclaw-service/controllers/commands/start-command.controller.js";
import { StopCommands } from "@nextclaw-service/controllers/commands/stop-command.controller.js";
import { UiCommands } from "@nextclaw-service/controllers/commands/ui-command.controller.js";
import { LlmUsageCommandService } from "@nextclaw-service/controllers/commands/usage-command.controller.js";
import type { ManagedServiceManager } from "@nextclaw-service/managers/managed-service.manager.js";
import type { ServiceRestartManager } from "@nextclaw-service/managers/service-restart.manager.js";
import type { ServiceWorkspaceManager } from "@nextclaw-service/managers/service-workspace.manager.js";

const FORCED_PUBLIC_UI_HOST = "0.0.0.0";

export { runCliAgentCommand };

export type NextclawServiceCommands = {
  remote: RemoteRuntimeActions;
  skills: SkillsCommands;
  service: ServiceCommands;
  config: ConfigCommands;
  mcp: McpCommands;
  secrets: SecretsCommands;
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
  usage: LlmUsageCommandService;
};

type ServiceCommandManagerDeps = {
  logo: string;
  init: (params: { source?: string; auto?: boolean; force?: boolean }) => Promise<void>;
  managedService: ManagedServiceManager;
  restart: ServiceRestartManager;
  workspace: ServiceWorkspaceManager;
};

export class ServiceCommandManager {
  readonly commands: NextclawServiceCommands;
  readonly platformAuth: PlatformAuthCommands;
  readonly remote: RemoteCommands;

  constructor(private readonly deps: ServiceCommandManagerDeps) {
    const start = new StartCommands({
      runtimeCommandService: this.deps.managedService,
      forcedPublicHost: FORCED_PUBLIC_UI_HOST,
      init: (params) => this.deps.init(params)
    });
    this.platformAuth = new PlatformAuthCommands();
    this.remote = new RemoteCommands();
    this.commands = {
      remote: new RemoteRuntimeActions({
        appName: APP_NAME,
        initAuto: (source) => this.deps.init({ source, auto: true }),
        remoteCommands: this.remote,
        restartBackgroundService: (reason) => this.deps.restart.restartBackgroundService(reason),
        hasRunningManagedService: hasRunningNextclawManagedService
      }),
      skills: new SkillsCommands(),
      service: new ServiceCommands(),
      config: new ConfigCommands({
        requestRestart: (params) => this.deps.restart.requestRestart(params),
      }),
      mcp: new McpCommands(),
      secrets: new SecretsCommands({
        requestRestart: (params) => this.deps.restart.requestRestart(params),
      }),
      agents: new AgentCommands(new AgentManager(undefined, {
        initializeAgentHomeDirectory: (homeDirectory) =>
          this.deps.workspace.createWorkspaceTemplates(homeDirectory),
      })),
      channels: new ChannelCommands({
        requestRestart: (params) => this.deps.restart.requestRestart(params),
      }),
      cron: new CronCommands(),
      diagnostics: new DiagnosticsCommands({ logo: this.deps.logo }),
      logs: new LogsCommands(),
      gateway: new GatewayCommands({
        runtimeCommandService: this.deps.managedService,
        forcedPublicHost: FORCED_PUBLIC_UI_HOST
      }),
      ui: new UiCommands({
        runtimeCommandService: this.deps.managedService,
        forcedPublicHost: FORCED_PUBLIC_UI_HOST
      }),
      start,
      restart: new RestartCommands({
        runtimeCommandService: this.deps.managedService,
        startCommands: start,
        forcedPublicHost: FORCED_PUBLIC_UI_HOST,
        writeRestartSentinelFromExecContext: (reason) => this.deps.restart.writeRestartSentinelFromExecContext(reason)
      }),
      serve: new ServeCommands({
        runtimeCommandService: this.deps.managedService,
        forcedPublicHost: FORCED_PUBLIC_UI_HOST
      }),
      stop: new StopCommands({
        runtimeCommandService: this.deps.managedService
      }),
      usage: new LlmUsageCommandService(),
    };
  }
}
