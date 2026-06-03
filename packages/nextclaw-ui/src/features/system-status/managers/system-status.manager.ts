import type { BootstrapStatusView } from '@/shared/lib/api';
import {
  fetchRuntimeControl,
  restartRuntimeService,
  startRuntimeService,
  stopRuntimeService,
} from '@/shared/lib/api';
import type {
  RuntimeControlAction,
  RuntimeControlActionResult,
  RuntimeControlView,
} from '@/shared/lib/api';
import { appQueryClient } from '@/app-query-client';
import type { NextClawDesktopBridge } from '@/platforms/desktop';
import { t } from '@/shared/lib/i18n';
import {
  buildActiveSystemActionState,
  toSystemStatusView,
} from '@/features/system-status/utils/system-status.utils';
import {
  initialSystemStatusState,
  useSystemStatusStore,
} from '@/features/system-status/stores/system-status.store';
import { isTransientRuntimeConnectionErrorMessage } from '@/shared/lib/transport';
import { AdaptiveCadence } from '@/shared/lib/cadence';

const RECOVERY_TIMEOUT_MS = 30_000;
const RUNTIME_BOOTSTRAP_PROBE_CADENCE = {
  idleDelayMs: 1_000,
  manualTriggerDelayMs: 0,
  successDelayMs: false,
  stages: [
    { untilElapsedMs: 30_000, delaysMs: [500, 1_000, 2_000, 4_000, 5_000] },
    { untilElapsedMs: 5 * 60_000, delaysMs: [10_000, 15_000, 30_000] },
    { delaysMs: [60_000] },
  ],
} as const;

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

function resolveActionHelp(action: RuntimeControlAction): string {
  if (action === 'start-service') {
    return t('runtimeControlStartingServiceHelp');
  }
  if (action === 'restart-service') {
    return t('runtimeControlRestartingServiceHelp');
  }
  if (action === 'stop-service') {
    return t('runtimeControlStoppingServiceHelp');
  }
  return t('runtimeControlRestartingAppHelp');
}

export class SystemStatusManager {
  private recoveryTimeoutId: number | null = null;
  private readonly runtimeBootstrapProbeCadence = new AdaptiveCadence(
    RUNTIME_BOOTSTRAP_PROBE_CADENCE,
  );

  getRuntimeBootstrapPollInterval = (
    status: BootstrapStatusView | null | undefined,
  ): number | false => {
    const { lifecyclePhase, activeSystemAction } = this.getState();
    const isRecovering =
      lifecyclePhase === 'recovering' ||
      lifecyclePhase === 'stalled' ||
      activeSystemAction?.lifecycle === 'recovering';
    if (this.runtimeBootstrapProbeCadence.hasManualTrigger()) {
      return this.runtimeBootstrapProbeCadence.getNextDelay({
        consumeManualTrigger: true,
      });
    }
    if (!isRecovering && status?.ncpAgent.state === 'ready') {
      return false;
    }
    return this.runtimeBootstrapProbeCadence.getNextDelay({
      consumeManualTrigger: true,
    });
  };

  getRuntimeControl = async (): Promise<RuntimeControlView> => {
    return this.decorateForCurrentEnvironment(await fetchRuntimeControl());
  };

  reportBootstrapStatus = (status: BootstrapStatusView): void => {
    const state = this.getState();
    const statusError = resolveBootstrapStatusError(status);

    if (status.ncpAgent.state === 'ready') {
      this.transitionToReady(status);
      return;
    }

    if (!state.hasReachedReady) {
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
    const state = this.getState();
    if (state.hasReachedReady) {
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
    const state = this.getState();
    if (!state.hasReachedReady) {
      this.runtimeBootstrapProbeCadence.recordFailure();
      this.patchState({
        lastTransportError: message,
      });
      return true;
    }
    this.transitionToRecovering(message);
    return true;
  };

  handleConnectionInterrupted = (message?: string | null): void => {
    const state = this.getState();
    const normalizedMessage = message?.trim() || null;
    if (!state.hasReachedReady) {
      this.runtimeBootstrapProbeCadence.recordFailure();
      if (normalizedMessage) {
        this.patchState({
          lastTransportError: normalizedMessage,
        });
      }
      return;
    }
    this.transitionToRecovering(normalizedMessage);
  };

  handleConnectionRestored = (): void => {
    const state = this.getState();
    if (state.bootstrapStatus?.ncpAgent.state === 'ready') {
      this.transitionToReady(state.bootstrapStatus);
    }
  };

  reportRuntimeControlView = (view: RuntimeControlView): void => {
    this.patchState({
      runtimeControlView: view,
      runtimeControlError: null,
    });
  };

  reportRuntimeControlError = (error: unknown): void => {
    const message = getErrorMessage(error).trim();
    if (!message) {
      return;
    }
    this.patchState({
      runtimeControlError: message,
    });
  };

  runRuntimeControlAction = async (
    action: RuntimeControlAction
  ): Promise<RuntimeControlActionResult> => {
    this.patchState({
      activeSystemAction: buildActiveSystemActionState({
        action,
        message: resolveActionHelp(action),
      }),
      lastSystemActionError: null,
    });

    try {
      const result = await this.executeRuntimeControlAction(action);
      if (action === 'restart-app') {
        return result;
      }

      if (action === 'stop-service') {
        await this.refreshRuntimeControlView();
        this.clearActiveSystemAction();
        return result;
      }

      this.patchState({
        activeSystemAction: {
          action,
          lifecycle: 'recovering',
          serviceState: null,
          message: t('runtimeControlRecoveringHelp'),
        },
      });
      this.runtimeBootstrapProbeCadence.requestManualTrigger();

      const recoveredView = await this.waitForRecovery();
      this.syncRuntimeControlQueryCache(recoveredView);
      this.reportRuntimeControlView(recoveredView);
      this.clearActiveSystemAction();
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('runtimeControlActionFailed');
      this.patchState({
        activeSystemAction: {
          action,
          lifecycle: 'failed',
          serviceState:
            action === 'stop-service' ? 'running' : action === 'restart-app' ? null : 'unknown',
          message,
        },
        lastSystemActionError: message,
      });
      throw error;
    }
  };

  getStatusView = () => toSystemStatusView(this.getState());

  requestRuntimeBootstrapProbeNow = (): void => {
    this.runtimeBootstrapProbeCadence.requestManualTrigger();
    void appQueryClient.refetchQueries({
      queryKey: ['runtime-bootstrap-status'],
    });
  };

  resetForTests = (): void => {
    this.clearRecoveryTimeout();
    this.runtimeBootstrapProbeCadence.reset();
    useSystemStatusStore.setState({
      state: initialSystemStatusState,
    });
  };

  private getState = () => {
    return useSystemStatusStore.getState().state;
  };

  private patchState = (patch: Partial<(typeof initialSystemStatusState)>) => {
    useSystemStatusStore.getState().patchState(patch);
  };

  private transitionToColdStarting = (
    bootstrapStatus: BootstrapStatusView
  ): void => {
    this.runtimeBootstrapProbeCadence.recordFailure();
    this.clearRecoveryTimeout();
    this.patchState({
      lifecyclePhase: 'cold-starting',
      recoveryStartedAt: null,
      bootstrapStatus,
      lastError: null,
    });
  };

  private transitionToStartupFailed = (
    errorMessage: string | null,
    bootstrapStatus?: BootstrapStatusView
  ): void => {
    this.runtimeBootstrapProbeCadence.recordFailure();
    this.clearRecoveryTimeout();
    this.patchState({
      lifecyclePhase: 'startup-failed',
      recoveryStartedAt: null,
      bootstrapStatus: bootstrapStatus ?? this.getState().bootstrapStatus,
      lastError: errorMessage,
    });
  };

  private transitionToRecovering = (
    errorMessage: string | null,
    bootstrapStatus?: BootstrapStatusView
  ): void => {
    this.runtimeBootstrapProbeCadence.recordFailure();
    const state = this.getState();
    if (!state.hasReachedReady) {
      this.patchState({
        lastTransportError: errorMessage?.trim() || state.lastTransportError,
      });
      return;
    }

    if (
      state.lifecyclePhase !== 'recovering' &&
      state.lifecyclePhase !== 'stalled'
    ) {
      this.clearRecoveryTimeout();
      this.recoveryTimeoutId = window.setTimeout(() => {
        this.recoveryTimeoutId = null;
        const current = this.getState();
        if (current.lifecyclePhase === 'recovering') {
          this.patchState({
            lifecyclePhase: 'stalled',
          });
        }
      }, RECOVERY_TIMEOUT_MS);
    }

    this.patchState({
      lifecyclePhase:
        state.lifecyclePhase === 'stalled' ? 'stalled' : 'recovering',
      recoveryStartedAt: state.recoveryStartedAt ?? Date.now(),
      bootstrapStatus: bootstrapStatus ?? state.bootstrapStatus,
      lastError: errorMessage?.trim() || state.lastError,
      lastTransportError: errorMessage?.trim() || state.lastTransportError,
    });
  };

  private transitionToReady = (
    bootstrapStatus: BootstrapStatusView | null
  ): void => {
    this.runtimeBootstrapProbeCadence.recordSuccess();
    const state = this.getState();
    const shouldRefreshQueries =
      state.lifecyclePhase === 'recovering' || state.lifecyclePhase === 'stalled';

    this.clearRecoveryTimeout();
    this.patchState({
      lifecyclePhase: 'ready',
      hasReachedReady: true,
      lastReadyAt: Date.now(),
      recoveryStartedAt: null,
      bootstrapStatus,
      lastError: null,
      lastTransportError: null,
    });

    if (shouldRefreshQueries) {
      void appQueryClient.refetchQueries({ type: 'active' });
    }
  };

  private executeRuntimeControlAction = async (
    action: RuntimeControlAction
  ): Promise<RuntimeControlActionResult> => {
    const desktopBridge = this.getDesktopBridge();
    if (
      action === 'restart-service' &&
      desktopBridge &&
      typeof desktopBridge.restartService === 'function'
    ) {
      const result = await desktopBridge.restartService();
      return {
        accepted: result.accepted,
        action: 'restart-service',
        lifecycle: result.lifecycle,
        message: result.message,
      };
    }
    if (action === 'start-service') {
      return await startRuntimeService();
    }
    if (action === 'stop-service') {
      return await stopRuntimeService();
    }
    if (action === 'restart-app') {
      if (!desktopBridge || typeof desktopBridge.restartApp !== 'function') {
        throw new Error(t('runtimeRestartAppUnavailable'));
      }
      const result = await desktopBridge.restartApp();
      return {
        accepted: result.accepted,
        action: 'restart-app',
        lifecycle: result.lifecycle,
        message: result.message,
      };
    }
    return await restartRuntimeService();
  };

  private waitForRecovery = async (): Promise<RuntimeControlView> => {
    const deadline = Date.now() + 25_000;
    let lastError: unknown = null;

    while (Date.now() < deadline) {
      try {
        return await this.getRuntimeControl();
      } catch (error) {
        lastError = error;
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1_500);
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(t('runtimeRecoveryTimedOut'));
  };

  private refreshRuntimeControlView = async (): Promise<void> => {
    try {
      const view = await this.getRuntimeControl();
      this.syncRuntimeControlQueryCache(view);
      this.reportRuntimeControlView(view);
    } catch (error) {
      this.reportRuntimeControlError(error);
    }
  };

  private syncRuntimeControlQueryCache = (view: RuntimeControlView): void => {
    appQueryClient.setQueryData(['runtime-control'], view);
  };

  private clearActiveSystemAction = (): void => {
    this.patchState({
      activeSystemAction: null,
      lastSystemActionError: null,
    });
  };

  private clearRecoveryTimeout = (): void => {
    if (this.recoveryTimeoutId !== null) {
      window.clearTimeout(this.recoveryTimeoutId);
      this.recoveryTimeoutId = null;
    }
  };

  private decorateForCurrentEnvironment = (
    view: RuntimeControlView
  ): RuntimeControlView => {
    const desktopBridge = this.getDesktopBridge();
    if (!desktopBridge || typeof desktopBridge.restartApp !== 'function') {
      return view;
    }

    return {
      ...view,
      environment: 'desktop-embedded',
      serviceState: 'running',
      canStartService: {
        available: false,
        requiresConfirmation: false,
        impact: 'none',
      },
      canStopService: {
        available: false,
        requiresConfirmation: true,
        impact: 'brief-ui-disconnect',
      },
      canRestartApp: {
        available: true,
        requiresConfirmation: true,
        impact: 'full-app-relaunch',
      },
      ownerLabel: t('runtimeControlEnvironmentDesktop'),
      managementHint: t('runtimeControlDesktopServiceHint'),
    };
  };

  private getDesktopBridge = (): NextClawDesktopBridge | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.nextclawDesktop ?? null;
  };
}

export const systemStatusManager = new SystemStatusManager();
