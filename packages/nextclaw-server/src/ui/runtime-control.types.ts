export type RuntimeControlEnvironment =
  | "desktop-embedded"
  | "managed-local-service"
  | "self-hosted-web"
  | "shared-web";

export type RuntimeLifecycleState =
  | "healthy"
  | "starting-service"
  | "restarting-service"
  | "stopping-service"
  | "restarting-app"
  | "recovering"
  | "unavailable"
  | "failed";

export type RuntimeActionImpact = "none" | "brief-ui-disconnect" | "full-app-relaunch";

export type RuntimeActionCapability = {
  available: boolean;
  requiresConfirmation: boolean;
  impact: RuntimeActionImpact;
  reasonIfUnavailable?: string;
};

export type RuntimeServiceState =
  | "running"
  | "stopped"
  | "starting"
  | "stopping"
  | "restarting"
  | "unknown";

export type RuntimePendingRestart = {
  changedPaths: string[];
  message: string;
  reasons: string[];
  requestedAt: string;
};

export type RuntimeControlView = {
  environment: RuntimeControlEnvironment;
  lifecycle: RuntimeLifecycleState;
  serviceState: RuntimeServiceState;
  canStartService: RuntimeActionCapability;
  canRestartService: RuntimeActionCapability;
  canStopService: RuntimeActionCapability;
  canRestartApp: RuntimeActionCapability;
  pendingRestart?: RuntimePendingRestart | null;
  ownerLabel?: string;
  managementHint?: string;
  message?: string;
};

export type RuntimeControlAction =
  | "start-service"
  | "restart-service"
  | "stop-service"
  | "restart-app";

export type RuntimeControlActionResult = {
  accepted: boolean;
  action: RuntimeControlAction;
  lifecycle: RuntimeLifecycleState;
  message: string;
};
