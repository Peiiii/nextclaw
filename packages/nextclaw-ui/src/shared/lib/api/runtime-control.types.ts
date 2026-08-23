export type RuntimeControlEnvironment =
  | 'desktop-embedded'
  | 'managed-local-service'
  | 'self-hosted-web'
  | 'shared-web';

export type RuntimeLifecycleState =
  | 'healthy'
  | 'starting-service'
  | 'restarting-service'
  | 'stopping-service'
  | 'restarting-app'
  | 'recovering'
  | 'unavailable'
  | 'failed';

export type RuntimeActionImpact = 'none' | 'brief-ui-disconnect' | 'full-app-relaunch';

export type RuntimeActionCapability = {
  available: boolean;
  requiresConfirmation: boolean;
  impact: RuntimeActionImpact;
  reasonIfUnavailable?: string;
};

export type RuntimeServiceState =
  | 'running'
  | 'stopped'
  | 'starting'
  | 'stopping'
  | 'restarting'
  | 'unknown';

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
  | 'start-service'
  | 'restart-service'
  | 'stop-service'
  | 'restart-app';

export type RuntimeControlActionResult = {
  accepted: boolean;
  action: RuntimeControlAction;
  lifecycle: RuntimeLifecycleState;
  message: string;
};
export type UiExtensionView = {
  id: string;
  name: string;
  version?: string;
  state: 'stopped' | 'starting' | 'running' | 'stopping' | 'failed';
  generation?: string;
  pid?: number;
  startedAt?: string;
  leaseCount: number;
  observations: { context: boolean; events: boolean };
  channels: Array<{ id: string; name?: string; description?: string }>;
};

export type UiExtensionsView = {
  extensions: UiExtensionView[];
  counts: { total: number; running: number; withObservations: number; withChannels: number };
};
