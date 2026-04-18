import type { BootstrapStatusView } from '@/api/types';
import { appQueryClient } from '@/app-query-client';
import { t } from '@/lib/i18n';
import {
  initialRuntimeLifecycleSnapshot,
  useRuntimeLifecycleStore,
} from './runtime-lifecycle.store';

const RECOVERY_TIMEOUT_MS = 30_000;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? '');
}

function resolveBootstrapStatusError(
  status: BootstrapStatusView | null | undefined
): string | null {
  if (!status) {
    return null;
  }
  return status.ncpAgent.error?.trim() || status.lastError?.trim() || null;
}

export function isTransientRuntimeConnectionErrorMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed') ||
    normalized.includes('request timed out') ||
    normalized.includes('timed out waiting for remote request response') ||
    normalized.includes('remote transport connection closed') ||
    normalized.includes('websocket error') ||
    normalized.includes('fetch failed on ') ||
    normalized.includes('stream request failed for ') ||
    normalized.includes('ncp fetch failed for ')
  );
}

export class RuntimeLifecycleManager {
  private recoveryTimeoutId: number | null = null;

  reportBootstrapStatus = (status: BootstrapStatusView): void => {
    const snapshot = this.getSnapshot();
    const statusError = resolveBootstrapStatusError(status);

    if (status.ncpAgent.state === 'ready') {
      this.transitionToReady(status);
      return;
    }

    if (!snapshot.hasReachedReady) {
      if (status.ncpAgent.state === 'error' || status.phase === 'error') {
        this.transitionToStartupFailed(statusError, status);
        return;
      }
      this.transitionToColdStarting(status);
      return;
    }

    this.transitionToRecovering(statusError, status);
  };

  reportBootstrapQueryError = (error: unknown): void => {
    const message = getErrorMessage(error).trim();
    if (!message) {
      return;
    }
    if (this.reportTransportFailure(message)) {
      return;
    }
    const snapshot = this.getSnapshot();
    if (snapshot.hasReachedReady) {
      this.transitionToRecovering(message);
      return;
    }
    this.transitionToStartupFailed(message);
  };

  reportTransportFailure = (error: unknown): boolean => {
    const message = getErrorMessage(error).trim();
    if (!isTransientRuntimeConnectionErrorMessage(message)) {
      return false;
    }
    const snapshot = this.getSnapshot();
    if (!snapshot.hasReachedReady) {
      useRuntimeLifecycleStore.getState().setSnapshot({
        lastTransportError: message,
      });
      return true;
    }
    this.transitionToRecovering(message);
    return true;
  };

  handleConnectionInterrupted = (message?: string | null): void => {
    const snapshot = this.getSnapshot();
    const normalizedMessage = message?.trim() || null;
    if (!snapshot.hasReachedReady) {
      if (normalizedMessage) {
        useRuntimeLifecycleStore.getState().setSnapshot({
          lastTransportError: normalizedMessage,
        });
      }
      return;
    }
    this.transitionToRecovering(normalizedMessage);
  };

  handleConnectionRestored = (): void => {
    const snapshot = this.getSnapshot();
    if (snapshot.bootstrapStatus?.ncpAgent.state === 'ready') {
      this.transitionToReady(snapshot.bootstrapStatus);
    }
  };

  getDisplayMessage = (message: string | null | undefined): string | null => {
    if (!message?.trim()) {
      return null;
    }
    const { phase } = this.getSnapshot();
    if (phase === 'recovering' && isTransientRuntimeConnectionErrorMessage(message)) {
      return t('runtimeControlRecoveringHelp');
    }
    if (phase === 'stalled' && isTransientRuntimeConnectionErrorMessage(message)) {
      return t('runtimeRecoveryTimedOut');
    }
    return message;
  };

  resetForTests = (): void => {
    this.clearRecoveryTimeout();
    useRuntimeLifecycleStore.setState({
      snapshot: initialRuntimeLifecycleSnapshot,
    });
  };

  private getSnapshot = () => {
    return useRuntimeLifecycleStore.getState().snapshot;
  };

  private transitionToColdStarting = (bootstrapStatus: BootstrapStatusView): void => {
    this.clearRecoveryTimeout();
    useRuntimeLifecycleStore.getState().setSnapshot({
      phase: 'cold-starting',
      recoveryStartedAt: null,
      bootstrapStatus,
      lastError: null,
    });
  };

  private transitionToStartupFailed = (
    errorMessage: string | null,
    bootstrapStatus?: BootstrapStatusView
  ): void => {
    this.clearRecoveryTimeout();
    useRuntimeLifecycleStore.getState().setSnapshot({
      phase: 'startup-failed',
      recoveryStartedAt: null,
      bootstrapStatus: bootstrapStatus ?? this.getSnapshot().bootstrapStatus,
      lastError: errorMessage,
    });
  };

  private transitionToRecovering = (
    errorMessage: string | null,
    bootstrapStatus?: BootstrapStatusView
  ): void => {
    const snapshot = this.getSnapshot();
    if (!snapshot.hasReachedReady) {
      useRuntimeLifecycleStore.getState().setSnapshot({
        lastTransportError: errorMessage?.trim() || snapshot.lastTransportError,
      });
      return;
    }

    if (snapshot.phase !== 'recovering' && snapshot.phase !== 'stalled') {
      this.clearRecoveryTimeout();
      this.recoveryTimeoutId = window.setTimeout(() => {
        this.recoveryTimeoutId = null;
        const current = this.getSnapshot();
        if (current.phase === 'recovering') {
          useRuntimeLifecycleStore.getState().setSnapshot({
            phase: 'stalled',
          });
        }
      }, RECOVERY_TIMEOUT_MS);
    }

    useRuntimeLifecycleStore.getState().setSnapshot({
      phase: snapshot.phase === 'stalled' ? 'stalled' : 'recovering',
      recoveryStartedAt: snapshot.recoveryStartedAt ?? Date.now(),
      bootstrapStatus:
        bootstrapStatus ??
        (snapshot.phase === 'ready' ? null : snapshot.bootstrapStatus),
      lastError: errorMessage?.trim() || snapshot.lastError,
      lastTransportError: errorMessage?.trim() || snapshot.lastTransportError,
    });
  };

  private transitionToReady = (bootstrapStatus: BootstrapStatusView | null): void => {
    const snapshot = this.getSnapshot();
    const shouldRefreshQueries =
      snapshot.phase === 'recovering' || snapshot.phase === 'stalled';

    this.clearRecoveryTimeout();
    useRuntimeLifecycleStore.getState().setSnapshot({
      phase: 'ready',
      hasReachedReady: true,
      lastReadyAt: Date.now(),
      recoveryStartedAt: null,
      bootstrapStatus,
      lastError: null,
      lastTransportError: null,
    });

    if (shouldRefreshQueries) {
      void Promise.all([
        appQueryClient.invalidateQueries(),
        appQueryClient.refetchQueries({ type: 'active' }),
      ]);
    }
  };

  private clearRecoveryTimeout = (): void => {
    if (this.recoveryTimeoutId !== null) {
      window.clearTimeout(this.recoveryTimeoutId);
      this.recoveryTimeoutId = null;
    }
  };
}

export const runtimeLifecycleManager = new RuntimeLifecycleManager();
