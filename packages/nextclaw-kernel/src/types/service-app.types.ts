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

/**
 * The versioned WIT surface used by a capability Provider and its Consumers.
 * A Provider carries an exact semver release; a Consumer carries the range it
 * accepts. This declaration is static manifest metadata, never a registry.
 */
export type ServiceAppWitContract = {
  package: string;
  interface: string;
  version: string;
};

export type ServiceAppCapabilityRequirement = {
  id: string;
  version?: string;
  /** A Provider Component packaged beside this Consumer. */
  provider?: string;
  wit?: ServiceAppWitContract;
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

/**
 * A portable Guest can name a slot but never a provider, model, or Agent.
 * The Kernel binds the slot through a capability grant after installation.
 */
export type ServiceAppModelCapabilitySlot = {
  id: string;
  title: string;
  description: string;
  required: boolean;
  maxTokens?: number;
  timeoutMs?: number;
};

export type ServiceAppAgentCapabilitySlot = {
  id: string;
  title: string;
  description: string;
  required: boolean;
};

export type ServiceAppRequirements = {
  capabilities?: ServiceAppCapabilityRequirement[];
  resources?: ServiceAppResourceRequirement[];
  modelSlots?: ServiceAppModelCapabilitySlot[];
  agentSlots?: ServiceAppAgentCapabilitySlot[];
};

/**
 * A stable capability exposed by a Service Provider App. Provider identity is
 * still the Service id; this declaration only describes what it can satisfy.
 */
export type ServiceAppCapabilityProvision = {
  id: string;
  version: string;
  wit?: ServiceAppWitContract;
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
  invocation?: ServiceActionInvocationFacts;
};

/**
 * Durable status for an explicitly asynchronous Service App invocation.
 * Terminal statuses are intentionally irreversible: a retry is a new job
 * linked through `retryOf`, never a rewrite of the original execution.
 */
export type ServiceAppJobStatus =
  | "queued"
  | "starting"
  | "running"
  | "succeeded"
  | "cancel-requested"
  | "cancelled"
  | "timed-out"
  | "failed"
  | "interrupted";

export type ServiceAppTerminalJobStatus = Extract<
  ServiceAppJobStatus,
  "succeeded" | "cancelled" | "timed-out" | "failed" | "interrupted"
>;

export type ServiceAppJobCaller = {
  surface: "panel" | "agent" | "installed-app-cli";
  id?: string;
};

export type ServiceAppJobView = {
  id: string;
  appId: string;
  instanceId: string;
  componentId: string;
  actionName: string;
  status: ServiceAppJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelRequestedAt?: string;
  retryOf?: string;
  callId: string;
  traceId: string;
  caller?: ServiceAppJobCaller;
  error?: { code?: string; message: string };
};

export type ServiceAppJobProgressEvent = {
  type: "progress";
  current?: number;
  total?: number;
  message?: string;
};

export type ServiceAppJobChunkEvent = {
  type: "stream-chunk";
  content: string;
};

export type ServiceAppJobTerminalEvent = {
  type: "terminal";
  status: ServiceAppTerminalJobStatus;
  error?: { code?: string; message: string };
};

export type ServiceAppJobEvent = {
  sequence: number;
  timestamp: string;
} & (ServiceAppJobProgressEvent | ServiceAppJobChunkEvent | ServiceAppJobTerminalEvent);

export type ServiceAppJobList = { entries: ServiceAppJobView[] };

export type ServiceAppJobWatch = {
  job: ServiceAppJobView;
  events: ServiceAppJobEvent[];
  /** Pass this value back as `afterSequence` to resume without a gap. */
  cursor: number;
};

/**
 * Durable host-owned delivery state for a Resident event.  A Resident is a
 * serial lane, therefore an acknowledged event is the only state permitted
 * to advance that stream's cursor.  Event payload is retained only in the
 * App instance journal, never in VerificationRecord evidence.
 */
export type ServiceAppResidentEventStatus =
  | "received"
  | "pending"
  | "leased"
  | "acked"
  | "retry-wait"
  | "dead-letter";

export type ServiceAppResidentEventDisposition =
  | { kind: "ack" }
  | { kind: "retry"; delayMs?: number; error?: { code?: string; message?: string } };

export type ServiceAppResidentEventView = {
  id: string;
  appId: string;
  instanceId: string;
  componentId: string;
  eventId: string;
  streamKey: string;
  sequence: number;
  status: ServiceAppResidentEventStatus;
  receivedAt: string;
  updatedAt: string;
  attempt: number;
  leaseExpiresAt?: string;
  nextAttemptAt?: string;
  ackedAt?: string;
  deadLetteredAt?: string;
  lastError?: { code?: string; message: string };
};

export type ServiceAppResidentEventList = {
  entries: ServiceAppResidentEventView[];
  cursors: Record<string, number>;
  frozen: boolean;
};

export type ServiceActionInvocationFacts = {
  callId: string;
  traceId: string;
  dataVersion: string;
  verificationRunId: string;
};

export type ServiceActionGrantRequest = {
  caller: ServiceActionCaller;
  declaredActions?: string[];
};
