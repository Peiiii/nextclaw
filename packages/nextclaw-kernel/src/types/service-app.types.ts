import type {
  AppPermissions,
  AppRuntimeIsolation,
  AppRuntimeProfile,
  AppStorageContext,
} from "@nextclaw/app-runtime";

export type ServiceAppProtocol = "mcp" | "wasi-component";

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
  timeoutMs?: number;
};

export type ServiceAppLifecycle =
  | { mode: "action" }
  | { mode: "resident"; eventIntervalMs: number }
  | { mode: "provider" };

/**
 * A dependency intentionally kept outside a portable `.napp` artifact.
 * It never carries credentials, connection strings, or installation commands.
 */
export type ServiceAppExternalRemediation = {
  kind: "agent-setup";
  summary: string;
  requiresUserAction?: boolean;
};

export type ServiceAppCapabilityRequirement = {
  id: string;
  version?: string;
  title?: string;
  description?: string;
  remediation?: ServiceAppExternalRemediation;
};

export type ServiceAppResourceRequirement = {
  binding: string;
  type: string;
  required?: boolean;
  title?: string;
  description?: string;
  remediation?: ServiceAppExternalRemediation;
};

export type ServiceAppRequirements = {
  capabilities?: ServiceAppCapabilityRequirement[];
  resources?: ServiceAppResourceRequirement[];
};

/**
 * A stable capability exposed by a Service Provider App. Provider identity is
 * still the Service id; this declaration only describes what it can satisfy.
 */
export type ServiceAppCapabilityProvision = {
  id: string;
  version: string;
  resourceTypes?: string[];
};

export type ServiceAppProvides = {
  capabilities?: ServiceAppCapabilityProvision[];
};

export type ServiceAppManifest = {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  protocol: ServiceAppProtocol;
  command?: string;
  args?: string[];
  componentEntry?: string;
  providerIds?: string[];
  lifecycle?: ServiceAppLifecycle;
  requires?: ServiceAppRequirements;
  provides?: ServiceAppProvides;
  actions: Record<string, ServiceAppManifestAction>;
};

export type ServiceAppRecord = {
  id: string;
  title: string;
  description?: string;
  dirPath: string;
  manifestPath: string;
  command?: string;
  args?: string[];
  cwd: string;
  enabled: boolean;
  protocol: ServiceAppProtocol;
  status: ServiceAppRuntimeStatus;
  lastError?: string;
  lastStartedAt?: string;
  lastReadyAt?: string;
  lastFailedAt?: string;
  sourceKind?: "workspace" | "package";
  packageId?: string;
  packageVersion?: string;
  packageDirectory?: string;
  dataDirectory?: string;
  instanceId?: string;
  storage?: AppStorageContext;
  isolation?: AppRuntimeIsolation;
  runtimeProfile?: AppRuntimeProfile;
  permissions?: AppPermissions;
  componentPath?: string;
  providerIds?: string[];
  lifecycle?: ServiceAppLifecycle;
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

export type PanelServiceActionCaller = {
  surface: "panel-app";
  appId: string;
};

export type AgentServiceActionCaller = {
  surface: "agent";
  agentId: string;
};

export type ServiceActionCaller =
  | PanelServiceActionCaller
  | AgentServiceActionCaller;

export type ServiceActionGrant = {
  caller: ServiceActionCaller;
  actionId: string;
  risk: ServiceActionRisk;
  grantedAt: string;
};

export type ServiceActionInvokeRequest = {
  caller: ServiceActionCaller;
  declaredActions?: string[];
  input?: Record<string, unknown>;
};

export type ServiceActionInvokeResult = {
  actionId: string;
  result: unknown;
};

export type ServiceActionGrantRequest = {
  caller: ServiceActionCaller;
  declaredActions?: string[];
};
