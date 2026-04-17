import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  RuntimeActionCapability,
  RuntimeControlAction,
  RuntimeControlView,
  RuntimeLifecycleState,
  RuntimeServiceState
} from '@/api/runtime-control.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRuntimeControl, useRuntimeServiceAction } from '@/hooks/use-runtime-control';
import { t } from '@/lib/i18n';
import { runtimeControlManager } from '@/runtime-control/runtime-control.manager';
import { Loader2, RotateCw, Square, Play } from 'lucide-react';
import { toast } from 'sonner';

type VisibleRuntimeAction = {
  action: RuntimeControlAction;
  capability: RuntimeActionCapability;
  label: string;
  icon: 'play' | 'rotate' | 'square';
  variant?: 'default' | 'secondary' | 'destructive';
};

function resolveLifecycleLabel(lifecycle: RuntimeLifecycleState): string {
  if (lifecycle === 'healthy') {
    return t('runtimeControlHealthy');
  }
  if (lifecycle === 'starting-service') {
    return t('runtimeControlStartingService');
  }
  if (lifecycle === 'restarting-service') {
    return t('runtimeControlRestartingService');
  }
  if (lifecycle === 'stopping-service') {
    return t('runtimeControlStoppingService');
  }
  if (lifecycle === 'restarting-app') {
    return t('runtimeControlRestartingApp');
  }
  if (lifecycle === 'recovering') {
    return t('runtimeControlRecovering');
  }
  if (lifecycle === 'failed') {
    return t('runtimeControlFailed');
  }
  return t('runtimeControlUnavailable');
}

function resolveServiceStateLabel(serviceState: RuntimeServiceState): string {
  if (serviceState === 'running') {
    return t('runtimeControlServiceRunning');
  }
  if (serviceState === 'stopped') {
    return t('runtimeControlServiceStopped');
  }
  if (serviceState === 'starting') {
    return t('runtimeControlServiceStarting');
  }
  if (serviceState === 'stopping') {
    return t('runtimeControlServiceStopping');
  }
  if (serviceState === 'restarting') {
    return t('runtimeControlServiceRestarting');
  }
  return t('runtimeControlServiceUnknown');
}

function resolveEnvironmentLabel(view: RuntimeControlView): string {
  if (view.environment === 'desktop-embedded') {
    return t('runtimeControlEnvironmentDesktop');
  }
  if (view.environment === 'managed-local-service') {
    return t('runtimeControlEnvironmentManagedService');
  }
  if (view.environment === 'self-hosted-web') {
    return t('runtimeControlEnvironmentSelfHosted');
  }
  return t('runtimeControlEnvironmentSharedWeb');
}

function resolveVisibleActions(controlView: RuntimeControlView | undefined): VisibleRuntimeAction[] {
  if (!controlView) {
    return [];
  }

  const actions: VisibleRuntimeAction[] = [
    {
      action: 'start-service',
      capability: controlView.canStartService,
      label: t('runtimeControlStartService'),
      icon: 'play'
    },
    {
      action: 'restart-service',
      capability: controlView.canRestartService,
      label: t('runtimeControlRestartService'),
      icon: 'rotate'
    },
    {
      action: 'stop-service',
      capability: controlView.canStopService,
      label: t('runtimeControlStopService'),
      icon: 'square',
      variant: 'destructive'
    },
    {
      action: 'restart-app',
      capability: controlView.canRestartApp,
      label: t('runtimeControlRestartApp'),
      icon: 'rotate',
      variant: 'secondary'
    }
  ];

  return actions.filter((item) => item.capability.available || Boolean(item.capability.reasonIfUnavailable));
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

function RuntimeActionIcon(props: { icon: VisibleRuntimeAction['icon']; busy: boolean }) {
  const { busy, icon } = props;
  if (busy) {
    return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
  }
  if (icon === 'play') {
    return <Play className="mr-2 h-4 w-4" />;
  }
  if (icon === 'square') {
    return <Square className="mr-2 h-4 w-4" />;
  }
  return <RotateCw className="mr-2 h-4 w-4" />;
}

export function RuntimeControlCard() {
  const queryClient = useQueryClient();
  const runtimeControlQuery = useRuntimeControl();
  const serviceActionMutation = useRuntimeServiceAction();
  const [localLifecycle, setLocalLifecycle] = useState<RuntimeLifecycleState | null>(null);
  const [localServiceState, setLocalServiceState] = useState<RuntimeServiceState | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<RuntimeControlAction | null>(null);

  const controlView = runtimeControlQuery.data;
  const displayedLifecycle = localLifecycle ?? controlView?.lifecycle ?? 'healthy';
  const displayedServiceState = localServiceState ?? controlView?.serviceState ?? 'unknown';
  const displayedMessage = localMessage ?? controlView?.message ?? t('runtimeControlDescription');
  const busy = serviceActionMutation.isPending || busyAction !== null || displayedLifecycle === 'recovering';
  const visibleActions = resolveVisibleActions(controlView);
  const pendingRestart = controlView?.pendingRestart ?? null;

  const resetLocalState = () => {
    setLocalLifecycle(null);
    setLocalServiceState(null);
    setLocalMessage(null);
    setBusyAction(null);
  };

  const handleServiceAction = async (action: Extract<RuntimeControlAction, 'start-service' | 'restart-service' | 'stop-service'>) => {
    const capability = action === 'start-service'
      ? controlView?.canStartService
      : action === 'stop-service'
        ? controlView?.canStopService
        : controlView?.canRestartService;

    if (!capability?.available) {
      toast.error(capability?.reasonIfUnavailable ?? t('runtimeControlLoadFailed'));
      return;
    }
    if (action === 'stop-service' && capability.requiresConfirmation && !window.confirm(t('runtimeControlStopServiceConfirm'))) {
      return;
    }

    setBusyAction(action);
    setLocalLifecycle(action === 'start-service' ? 'starting-service' : action === 'stop-service' ? 'stopping-service' : 'restarting-service');
    setLocalServiceState(action === 'start-service' ? 'starting' : action === 'stop-service' ? 'stopping' : 'restarting');
    setLocalMessage(resolveActionHelp(action));

    try {
      const result = await serviceActionMutation.mutateAsync(action);
      toast.success(result.message);
      if (action === 'stop-service') {
        return;
      }
      setLocalLifecycle('recovering');
      setLocalMessage(t('runtimeControlRecoveringHelp'));
      const recoveredView = await runtimeControlManager.waitForRecovery();
      queryClient.setQueryData(['runtime-control'], recoveredView);
      await queryClient.invalidateQueries({ queryKey: ['runtime-control'] });
      resetLocalState();
      toast.success(t('runtimeControlRecovered'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('runtimeControlActionFailed');
      setLocalLifecycle('failed');
      setLocalServiceState(action === 'stop-service' ? 'running' : 'unknown');
      setLocalMessage(message);
      setBusyAction(null);
      toast.error(`${t('runtimeControlActionFailed')}: ${message}`);
    }
  };

  const handleRestartApp = async () => {
    if (!controlView?.canRestartApp.available) {
      toast.error(controlView?.canRestartApp.reasonIfUnavailable ?? t('runtimeRestartAppUnavailable'));
      return;
    }
    if (!window.confirm(t('runtimeControlRestartAppConfirm'))) {
      return;
    }

    setBusyAction('restart-app');
    setLocalLifecycle('restarting-app');
    setLocalMessage(t('runtimeControlRestartingAppHelp'));

    try {
      const result = await runtimeControlManager.restartApp();
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('runtimeControlActionFailed');
      setLocalLifecycle('failed');
      setLocalMessage(message);
      setBusyAction(null);
      toast.error(`${t('runtimeControlActionFailed')}: ${message}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('runtimeControlTitle')}</CardTitle>
        <CardDescription>{t('runtimeControlDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-medium text-gray-900">{resolveServiceStateLabel(displayedServiceState)}</div>
            <div className="text-xs text-gray-500">
              {controlView ? resolveEnvironmentLabel(controlView) : t('runtimeControlLoading')}
            </div>
          </div>
          <p className="text-sm text-gray-600">{displayedMessage}</p>
          <div className="text-xs text-gray-500">{resolveLifecycleLabel(displayedLifecycle)}</div>
          {controlView?.managementHint ? (
            <p className="text-xs text-gray-500">{controlView.managementHint}</p>
          ) : null}
          {runtimeControlQuery.isError && !busy ? (
            <p className="text-sm text-amber-700">
              {runtimeControlQuery.error instanceof Error ? runtimeControlQuery.error.message : t('runtimeControlLoadFailed')}
            </p>
          ) : null}
        </div>

        {pendingRestart ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="text-sm font-medium text-amber-900">{t('runtimeControlPendingRestartTitle')}</div>
            <p className="text-sm text-amber-800">{t('runtimeControlPendingRestartDescription')}</p>
            {pendingRestart.changedPaths.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-amber-700">
                  {t('runtimeControlPendingRestartPaths')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingRestart.changedPaths.map((path) => (
                    <span
                      key={path}
                      className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-amber-800"
                    >
                      {path}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
          {visibleActions.map((item) => {
            const isBusyAction = busyAction === item.action;
            const disabled = !item.capability.available || busy;
            const handleClick = () => {
              if (item.action === 'restart-app') {
                void handleRestartApp();
                return;
              }
              void handleServiceAction(item.action);
            };

            return (
              <Button
                key={item.action}
                type="button"
                variant={item.variant ?? 'default'}
                onClick={handleClick}
                disabled={disabled}
              >
                <RuntimeActionIcon icon={item.icon} busy={isBusyAction} />
                {item.label}
              </Button>
            );
          })}
        </div>

        {visibleActions
          .filter((item) => !item.capability.available && item.capability.reasonIfUnavailable)
          .map((item) => (
            <p key={`${item.action}-reason`} className="text-xs text-gray-500">
              {item.capability.reasonIfUnavailable}
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
