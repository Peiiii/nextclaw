import type { RestartStrategy } from "./restart-coordinator.js";
import type { RemoteRuntimeState } from "@nextclaw/remote";

export type {
  RemoteConnectCommandOptions,
  RemoteDoctorCommandOptions,
  RemoteEnableCommandOptions,
  RemoteStatusCommandOptions
} from "@nextclaw/remote";

export type GatewayCommandOptions = {
  ui?: boolean;
  uiPort?: string | number;
  uiOpen?: boolean;
};

export type UiCommandOptions = {
  port?: string | number;
  open?: boolean;
};

export type StartCommandOptions = {
  uiPort?: string | number;
  open?: boolean;
  startTimeout?: string | number;
};

export type AgentCommandOptions = {
  message?: string;
  session?: string;
  markdown?: boolean;
  model?: string;
};

export type UpdateCommandOptions = {
  timeout?: string | number;
};

export type LoginCommandOptions = {
  apiBase?: string;
  email?: string;
  password?: string;
};

export type PluginsListOptions = {
  json?: boolean;
  enabled?: boolean;
  verbose?: boolean;
};

export type PluginsInfoOptions = {
  json?: boolean;
};

export type PluginsInstallOptions = {
  link?: boolean;
};

export type PluginsUninstallOptions = {
  keepFiles?: boolean;
  keepConfig?: boolean;
  force?: boolean;
  dryRun?: boolean;
};

export type ChannelsAddOptions = {
  channel: string;
  code?: string;
  token?: string;
  name?: string;
  url?: string;
  httpUrl?: string;
};

export type ChannelsLoginOptions = {
  channel?: string;
  account?: string;
  url?: string;
  httpUrl?: string;
  verbose?: boolean;
};

export type ConfigGetOptions = {
  json?: boolean;
};

export type ConfigSetOptions = {
  json?: boolean;
};

export type McpListOptions = {
  json?: boolean;
};

export type McpAddCommandOptions = {
  transport?: string;
  url?: string;
  header?: string[];
  env?: string[];
  cwd?: string;
  timeoutMs?: string | number;
  disabled?: boolean;
  allAgents?: boolean;
  agent?: string[];
  stderr?: string;
  insecure?: boolean;
};

export type McpDoctorOptions = {
  json?: boolean;
};

export type SecretsAuditOptions = {
  json?: boolean;
  strict?: boolean;
};

export type SecretsConfigureOptions = {
  provider?: string;
  source?: string;
  prefix?: string;
  path?: string;
  command?: string;
  arg?: string[];
  cwd?: string;
  timeoutMs?: string | number;
  setDefault?: boolean;
  remove?: boolean;
  json?: boolean;
};

export type SecretsApplyOptions = {
  path?: string;
  source?: string;
  id?: string;
  provider?: string;
  file?: string;
  remove?: boolean;
  enable?: boolean;
  disable?: boolean;
  json?: boolean;
};

export type SecretsReloadOptions = {
  json?: boolean;
};

export type CronAddOptions = {
  name: string;
  message: string;
  every?: string;
  cron?: string;
  at?: string;
  deliver?: boolean;
  to?: string;
  channel?: string;
  account?: string;
};

export type StatusCommandOptions = {
  json?: boolean;
  verbose?: boolean;
  fix?: boolean;
};

export type DoctorCommandOptions = {
  json?: boolean;
  verbose?: boolean;
  fix?: boolean;
};

export type HealthProbe = {
  state: "ok" | "unreachable" | "invalid-response";
  detail: string;
  payload?: unknown;
};

export type RuntimeStatusReport = {
  generatedAt: string;
  configPath: string;
  configExists: boolean;
  workspacePath: string;
  workspaceExists: boolean;
  model: string;
  providers: Array<{ name: string; configured: boolean; detail: string }>;
  serviceStatePath: string;
  serviceStateExists: boolean;
  fixActions: string[];
  process: {
    managedByState: boolean;
    pid: number | null;
    running: boolean;
    staleState: boolean;
    orphanSuspected: boolean;
    startedAt: string | null;
  };
  endpoints: {
    uiUrl: string | null;
    apiUrl: string | null;
    configuredUiUrl: string;
    configuredApiUrl: string;
  };
  health: {
    managed: HealthProbe;
    configured: HealthProbe;
  };
  issues: string[];
  recommendations: string[];
  logTail: string[];
  remote: {
    configuredEnabled: boolean;
    runtime: RemoteRuntimeState | null;
  };
  level: "healthy" | "degraded" | "stopped";
  exitCode: 0 | 1 | 2;
};

export type RequestRestartParams = {
  reason: string;
  manualMessage: string;
  strategy?: RestartStrategy;
  delayMs?: number;
  silentOnServiceRestart?: boolean;
};
