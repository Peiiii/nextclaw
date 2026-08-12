import type { AppPackageOperationView } from '@nextclaw/client-sdk';
import { Check, LoaderCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

export function MarketplaceInstallButton({
  active,
  canUpdate,
  failed,
  installed,
  isStarting,
  onAction,
  operation,
}: {
  active: boolean;
  canUpdate: boolean;
  failed: boolean;
  installed: boolean;
  isStarting: boolean;
  onAction: () => void;
  operation?: AppPackageOperationView;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={installed && !canUpdate || active ? 'secondary' : 'default'}
      disabled={installed && !canUpdate || active || isStarting}
      onClick={onAction}
      className="shrink-0 rounded-full px-4"
    >
      {installed && !canUpdate ? (
        <><Check className="mr-1.5 h-3.5 w-3.5" />{t('appPackagesMarketplaceInstalled')}</>
      ) : active || isStarting ? (
        <><LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />{operation ? operationStatusLabel(operation) : t('appPackagesPreparing')}</>
      ) : canUpdate ? t('appPackagesUpdate') : failed ? t('appPackagesRetry') : t('appPackagesInstall')}
    </Button>
  );
}

export function OperationProgress({ operation }: { operation: AppPackageOperationView }) {
  const progress = Math.max(4, Math.round((operation.completedSteps / operation.totalSteps) * 100));
  const failed = operation.status === 'failed' || operation.status === 'interrupted';
  return (
    <div className="mt-2" role={failed ? 'alert' : 'status'} aria-live="polite">
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', failed ? 'bg-destructive' : 'bg-primary')}
          style={{ width: failed ? '100%' : `${progress}%` }}
        />
      </div>
      <p className={cn('mt-1.5 truncate text-[11px]', failed ? 'text-destructive' : 'text-muted-foreground')}>
        {failed ? operation.error ?? t('appPackagesActionFailed') : operationStatusLabel(operation)}
      </p>
    </div>
  );
}

export function findLatestAppPackageOperation(
  operations: AppPackageOperationView[],
  appId: string,
  source: string,
): AppPackageOperationView | undefined {
  return operations.find((entry) => entry.appId === appId || entry.source === source);
}

function operationStatusLabel(operation: AppPackageOperationView): string {
  switch (operation.status) {
    case 'queued': return t('appPackagesPreparing');
    case 'resolving': return t('appPackagesResolving');
    case 'downloading': return t('appPackagesDownloading');
    case 'verifying': return t('appPackagesVerifying');
    case 'installing': return operation.action === 'rollback'
      ? t('appPackagesSwitchingVersion')
      : operation.action === 'uninstall'
        ? t('appPackagesUninstalling')
        : t('appPackagesInstalling');
    case 'finalizing': return t('appPackagesFinalizing');
    case 'succeeded': return t('appPackagesCompleted');
    case 'failed':
    case 'interrupted': return t('appPackagesActionFailed');
  }
}
