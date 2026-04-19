import { t } from '@/lib/i18n';
import type {
  RuntimeControlAction,
  RuntimeLifecycleState,
  RuntimeServiceState,
} from '@/api/runtime-control.types';
import type {
  RuntimeControlPanelView,
  RuntimeStatusBadgeView,
  SystemConnectionStatus,
  SystemStatusPhase,
  SystemStatusState,
  SystemStatusView,
} from '@/features/system-status/types/system-status.types';

function resolveSystemStatusPhase(state: SystemStatusState): SystemStatusPhase {
  return state.activeSystemAction ? 'service-transitioning' : state.lifecyclePhase;
}

export function resolveSystemConnectionStatus(
  phase: SystemStatusPhase
): SystemConnectionStatus {
  if (phase === 'ready') {
    return 'connected';
  }
  if (phase === 'startup-failed' || phase === 'stalled') {
    return 'disconnected';
  }
  return 'connecting';
}

export function resolveChatRuntimeMessage(
  state: SystemStatusState
): string | null {
  if (state.activeSystemAction?.message?.trim()) {
    return state.activeSystemAction.message.trim();
  }
  if (state.lifecyclePhase === 'cold-starting') {
    return t('chatRuntimeInitializing');
  }
  if (state.lifecyclePhase === 'startup-failed') {
    return (
      state.bootstrapStatus?.ncpAgent.error?.trim() ||
      state.bootstrapStatus?.lastError?.trim() ||
      state.lastError?.trim() ||
      t('chatRuntimeInitializationFailed')
    );
  }
  return null;
}

export function toSystemStatusView(
  state: SystemStatusState
): SystemStatusView {
  const phase = resolveSystemStatusPhase(state);
  return {
    ...state,
    phase,
    connectionStatus: resolveSystemConnectionStatus(phase),
    isChatBlocked: phase !== 'ready',
    chatMessage: resolveChatRuntimeMessage(state),
  };
}

function resolveActionLifecycleLabel(
  action: RuntimeControlAction
): RuntimeLifecycleState {
  if (action === 'start-service') {
    return 'starting-service';
  }
  if (action === 'stop-service') {
    return 'stopping-service';
  }
  if (action === 'restart-service') {
    return 'restarting-service';
  }
  return 'restarting-app';
}

function resolveActionServiceState(
  action: RuntimeControlAction
): RuntimeServiceState | null {
  if (action === 'start-service') {
    return 'starting';
  }
  if (action === 'stop-service') {
    return 'stopping';
  }
  if (action === 'restart-service') {
    return 'restarting';
  }
  return null;
}

export function buildActiveSystemActionState(params: {
  action: RuntimeControlAction;
  message: string | null;
}): SystemStatusState['activeSystemAction'] {
  const { action, message } = params;
  return {
    action,
    lifecycle: resolveActionLifecycleLabel(action),
    serviceState: resolveActionServiceState(action),
    message,
  };
}

export function toRuntimeStatusBadgeView(
  state: SystemStatusState
): RuntimeStatusBadgeView {
  if (state.runtimeControlError) {
    return {
      tone: 'inactive',
      title: t('runtimeControlLoadFailed'),
      description: state.runtimeControlError,
      reasonLines: [],
      actionLabel: null,
      isBusy: false,
    };
  }

  if (!state.runtimeControlView) {
    return {
      tone: 'inactive',
      title: t('runtimeStatusLoadingTitle'),
      description: t('runtimeStatusLoadingDescription'),
      reasonLines: [],
      actionLabel: null,
      isBusy: Boolean(state.activeSystemAction),
    };
  }

  if (state.activeSystemAction) {
    return {
      tone: 'attention',
      title: t('runtimeControlTitle'),
      description:
        state.activeSystemAction.message ||
        state.runtimeControlView.message ||
        t('runtimeControlDescription'),
      reasonLines: [],
      actionLabel: null,
      isBusy: true,
    };
  }

  const view = state.runtimeControlView;
  if (view.pendingRestart) {
    return {
      tone: 'attention',
      title: t('runtimeStatusPendingRestartTitle'),
      description: t('runtimeStatusPendingRestartDescription'),
      reasonLines:
        view.pendingRestart.changedPaths.length > 0
          ? view.pendingRestart.changedPaths.map((path: string) =>
              t('runtimeStatusPendingRestartReasonItem').replace('{path}', path)
            )
          : [view.pendingRestart.message],
      actionLabel: view.canRestartService.available
        ? t('runtimeStatusRestartAction')
        : null,
      isBusy: false,
    };
  }

  return {
    tone: view.lifecycle === 'healthy' ? 'healthy' : 'inactive',
    title: t('runtimeStatusHealthyTitle'),
    description: t('runtimeStatusHealthyDescription'),
    reasonLines: [],
    actionLabel: null,
    isBusy: false,
  };
}

export function toRuntimeControlPanelView(
  state: SystemStatusState
): RuntimeControlPanelView {
  const action = state.activeSystemAction;
  const controlView = state.runtimeControlView;
  const visibleLifecycle =
    action?.lifecycle ?? controlView?.lifecycle ?? 'healthy';
  const visibleServiceState =
    action?.serviceState ?? controlView?.serviceState ?? 'unknown';
  const visibleMessage =
    action?.message ||
    state.lastSystemActionError ||
    controlView?.message ||
    t('runtimeControlDescription');

  return {
    controlView,
    visibleLifecycle,
    visibleServiceState,
    visibleMessage,
    busyAction: action?.action ?? null,
    busy: Boolean(action),
    pendingRestart: controlView?.pendingRestart ?? null,
    errorMessage:
      state.lastSystemActionError || state.runtimeControlError || null,
  };
}
