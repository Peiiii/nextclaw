import type { RestartStrategy } from "./restart-coordinator.js";

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
};

export type AgentCommandOptions = {
  message?: string;
  session?: string;
  markdown?: boolean;
};

export type UpdateCommandOptions = {
  timeout?: string | number;
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

export type ConfigGetOptions = {
  json?: boolean;
};

export type ConfigSetOptions = {
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
