import type { AppPackageOperationView } from '@nextclaw/client-sdk';
import { Check, LoaderCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { t } from '@/shared/lib/i18n';
import type { AppMarketplaceInstallability } from '@/features/apps/utils/app-marketplace-platform.utils';

export type MarketplaceCompatibilityPresentation = {
  actionLabel: string;
  badgeLabel?: string;
  reason: string;
  statusLabel: string;
};

export function readMarketplaceCompatibilityPresentation(
  installability: AppMarketplaceInstallability,
  supportedPlatforms: string,
): MarketplaceCompatibilityPresentation | undefined {
  if (installability.status === 'compatible') return undefined;
  if (installability.status === 'unknown') {
    return {
      actionLabel: t('appPackagesTemporarilyUnavailable'),
      reason: t('appPackagesCompatibilityUnknownReason'),
      statusLabel: t('appPackagesCompatibilityUnknown'),
    };
  }
  return {
    actionLabel: t('appPackagesUnavailable'),
    badgeLabel: t('appPackagesPlatformOnly').replace('{platforms}', supportedPlatforms),
    reason: installability.reason === 'unsupported-os'
      ? t('appPackagesUnsupportedOsReason').replace('{platforms}', supportedPlatforms)
      : t('appPackagesUnsupportedTargetReason').replace('{platforms}', supportedPlatforms),
    statusLabel: t('appPackagesUnavailableOnDevice'),
  };
}

export function MarketplaceCompatibilityBadge({
  presentation,
}: {
  presentation?: MarketplaceCompatibilityPresentation;
}) {
  if (!presentation?.badgeLabel) return null;
  return (
    <span className="mt-1.5 inline-flex rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-300">
      {presentation.badgeLabel}
    </span>
  );
}

export function MarketplaceCompatibilityStatus({
  blocked,
  presentation,
  className,
}: {
  blocked: boolean;
  presentation?: MarketplaceCompatibilityPresentation;
  className?: string;
}) {
  if (!blocked || !presentation) return null;
  return <p className={className}>{presentation.statusLabel}</p>;
}

export function MarketplaceInstallButton({
  active,
  canUpdate,
  installed,
  isStarting,
  onAction,
  operation,
  unavailableLabel,
  unavailableReason,
}: {
  active: boolean;
  canUpdate: boolean;
  installed: boolean;
  isStarting: boolean;
  onAction: () => void;
  operation?: AppPackageOperationView;
  unavailableLabel?: string;
  unavailableReason?: string;
}) {
  const disabled = Boolean(unavailableReason) || installed && !canUpdate || active || isStarting;
  const button = (
    <Button
      type="button"
      size="sm"
      variant={installed && !canUpdate || active ? 'secondary' : 'default'}
      disabled={disabled}
      onClick={onAction}
      className="shrink-0 rounded-full px-4"
    >
      {renderInstallButtonContent({
        active,
        canUpdate,
        installed,
        isStarting,
        operation,
        unavailableLabel,
        unavailableReason,
      })}
    </Button>
  );
  if (!unavailableReason) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex cursor-not-allowed rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-xs">
        {unavailableReason}
      </TooltipContent>
    </Tooltip>
  );
}

function renderInstallButtonContent({
  active,
  canUpdate,
  installed,
  isStarting,
  operation,
  unavailableLabel,
  unavailableReason,
}: {
  active: boolean;
  canUpdate: boolean;
  installed: boolean;
  isStarting: boolean;
  operation?: AppPackageOperationView;
  unavailableLabel?: string;
  unavailableReason?: string;
}) {
  if (unavailableReason) return unavailableLabel ?? t('appPackagesUnavailable');
  if (installed && !canUpdate) {
    return <><Check className="mr-1.5 h-3.5 w-3.5" />{t('appPackagesMarketplaceInstalled')}</>;
  }
  if (active || isStarting) {
    return (
      <>
        <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        {operation ? operationStatusLabel(operation) : t('appPackagesPreparing')}
      </>
    );
  }
  if (canUpdate) return t('appPackagesUpdate');
  return t('appPackagesInstall');
}

export function OperationProgress({ operation }: { operation: AppPackageOperationView }) {
  const progress = Math.max(4, Math.round((operation.completedSteps / operation.totalSteps) * 100));
  return (
    <div className="mt-2" role="status" aria-live="polite">
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
        {operationStatusLabel(operation)}
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
