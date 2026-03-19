import type { Config } from "@nextclaw/core";

export type RemoteConnectCommandOptions = {
  apiBase?: string;
  localOrigin?: string;
  name?: string;
  once?: boolean;
};

export type RemoteEnableCommandOptions = {
  apiBase?: string;
  name?: string;
};

export type RemoteStatusCommandOptions = {
  json?: boolean;
};

export type RemoteDoctorCommandOptions = {
  json?: boolean;
};

export type RemoteRuntimeState = {
  enabled: boolean;
  mode: "service" | "foreground";
  state: "disabled" | "connecting" | "connected" | "disconnected" | "error";
  deviceId?: string;
  deviceName?: string;
  platformBase?: string;
  localOrigin?: string;
  lastConnectedAt?: string | null;
  lastError?: string | null;
  updatedAt: string;
};

export type RemoteStatusSnapshot = {
  configuredEnabled: boolean;
  runtime: RemoteRuntimeState | null;
};

export type RemoteLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type RemoteServiceStateView = {
  pid: number;
  uiPort?: number;
};

export type RegisteredRemoteDevice = {
  id: string;
  deviceInstallId: string;
  displayName: string;
  platform: string;
  appVersion: string;
  localOrigin: string;
  status: "online" | "offline";
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RemoteStatusWriter = {
  write: (next: Omit<RemoteRuntimeState, "mode" | "updatedAt">) => void;
};

export type RemoteConnectorRunOptions = RemoteConnectCommandOptions & {
  signal?: AbortSignal;
  mode?: "foreground" | "service";
  autoReconnect?: boolean;
  statusStore?: RemoteStatusWriter;
};

export type RemoteRunContext = {
  config: Config;
  platformBase: string;
  token: string;
  localOrigin: string;
  displayName: string;
  deviceInstallId: string;
  autoReconnect: boolean;
};

export type RemotePlatformClientDeps = {
  loadConfig: () => Config;
  getDataDir: () => string;
  getPackageVersion: () => string;
  resolvePlatformBase: (rawApiBase: string) => string;
  readManagedServiceState?: () => RemoteServiceStateView | null;
  isProcessRunning?: (pid: number) => boolean;
};
