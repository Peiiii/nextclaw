export type ServiceAppProtocol = "mcp";

export type ServiceActionRisk = "read" | "write" | "external" | "dangerous";

export type ServiceAppRuntimeStatus =
  | "idle"
  | "starting"
  | "running"
  | "failed"
  | "stopped";

export type ServiceAppManifestAction = {
  risk?: ServiceActionRisk;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type ServiceAppManifest = {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  protocol: ServiceAppProtocol;
  command: string;
  args: string[];
  actions: Record<string, ServiceAppManifestAction>;
};

export type ServiceAppRecord = {
  id: string;
  title: string;
  description?: string;
  dirPath: string;
  manifestPath: string;
  enabled: boolean;
  protocol: ServiceAppProtocol;
  status: ServiceAppRuntimeStatus;
  lastError?: string;
  lastReadyAt?: string;
};

export type ServiceActionGrantState =
  | "granted"
  | "not-granted"
  | "not-declared";

export type ServiceActionRuntimeState =
  | "matched"
  | "missing"
  | "undeclared";

export type ServiceAction = {
  id: string;
  appId: string;
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  risk: ServiceActionRisk;
  runtimeState?: ServiceActionRuntimeState;
  grantState?: ServiceActionGrantState;
};

export type ServiceActionCaller = {
  surface: "panel-app";
  appId: string;
};

export type ServiceActionGrant = {
  caller: ServiceActionCaller;
  actionId: string;
  risk: ServiceActionRisk;
  grantedAt: string;
};

export type ServiceActionInvokeRequest = {
  caller: ServiceActionCaller;
  declaredActions: string[];
  input?: Record<string, unknown>;
};

export type ServiceActionInvokeResult = {
  actionId: string;
  result: unknown;
};

export type ServiceActionGrantRequest = {
  caller: ServiceActionCaller;
  declaredActions: string[];
};
