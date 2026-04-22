import type { BootstrapStatusView } from '@/shared/lib/api';
import type {
  RuntimeControlAction,
  RuntimeControlView,
  RuntimeLifecycleState,
  RuntimeServiceState,
} from '@/shared/lib/api';

export type SystemStatusLifecyclePhase =
  | 'cold-starting'
  | 'ready'
  | 'recovering'
  | 'stalled'
  | 'startup-failed';

export type SystemStatusPhase =
  | SystemStatusLifecyclePhase
  | 'service-transitioning';

export type SystemConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting';

export type ActiveSystemActionState = {
  action: RuntimeControlAction;
  lifecycle: RuntimeLifecycleState;
  serviceState: RuntimeServiceState | null;
  message: string | null;
};

export type SystemStatusState = {
  lifecyclePhase: SystemStatusLifecyclePhase;
  hasReachedReady: boolean;
  lastReadyAt: number | null;
  recoveryStartedAt: number | null;
  bootstrapStatus: BootstrapStatusView | null;
  lastError: string | null;
  lastTransportError: string | null;
  runtimeControlView: RuntimeControlView | null;
  runtimeControlError: string | null;
  activeSystemAction: ActiveSystemActionState | null;
  lastSystemActionError: string | null;
};

export type SystemStatusView = SystemStatusState & {
  phase: SystemStatusPhase;
  connectionStatus: SystemConnectionStatus;
  isChatBlocked: boolean;
  chatMessage: string | null;
};

export type RuntimeStatusTone = 'healthy' | 'attention' | 'inactive';

export type RuntimeStatusBadgeView = {
  actionLabel: string | null;
  description: string;
  reasonLines: string[];
  title: string;
  tone: RuntimeStatusTone;
  isBusy: boolean;
};

export type RuntimeControlPanelView = {
  controlView: RuntimeControlView | null;
  visibleLifecycle: RuntimeLifecycleState;
  visibleServiceState: RuntimeServiceState;
  visibleMessage: string;
  busyAction: RuntimeControlAction | null;
  busy: boolean;
  pendingRestart: RuntimeControlView['pendingRestart'] | null;
  errorMessage: string | null;
};
