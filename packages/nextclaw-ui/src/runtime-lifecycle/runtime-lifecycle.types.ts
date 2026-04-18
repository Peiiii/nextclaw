import type { BootstrapStatusView } from '@/api/types';

export type RuntimeLifecyclePhase =
  | 'cold-starting'
  | 'ready'
  | 'recovering'
  | 'stalled'
  | 'startup-failed';

export type RuntimeConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting';

export type RuntimeLifecycleSnapshot = {
  phase: RuntimeLifecyclePhase;
  hasReachedReady: boolean;
  lastReadyAt: number | null;
  recoveryStartedAt: number | null;
  bootstrapStatus: BootstrapStatusView | null;
  lastError: string | null;
  lastTransportError: string | null;
};

export type RuntimeLifecycleView = RuntimeLifecycleSnapshot & {
  chatRuntimeBlocked: boolean;
  chatRuntimeMessage: string | null;
  connectionStatus: RuntimeConnectionStatus;
};
