import type { AppPackageView } from '@nextclaw/client-sdk';
import { t } from '@/shared/lib/i18n';

export type AppPackageAvailability = {
  className: string;
  interactive: boolean;
  label: string;
  message?: string;
  messageClassName?: string;
};

export function readAppPackageAvailability(
  appPackage: AppPackageView,
  unavailableMessage: string | undefined,
): AppPackageAvailability {
  if (unavailableMessage) {
    return {
      className: 'bg-destructive/10 text-destructive',
      interactive: false,
      label: t('appPackagesUnavailable'),
      message: unavailableMessage,
      messageClassName: 'text-destructive',
    };
  }
  if (!appPackage.enabled && appPackage.readiness.status !== 'ready') {
    const needsCapability = appPackage.readiness.status === 'needs-capability';
    return {
      className: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
      interactive: false,
      label: needsCapability ? t('appPackagesNeedsCapability') : t('appPackagesNeedsConfiguration'),
      message: t(needsCapability
        ? 'appPackagesNeedsCapabilityDescription'
        : 'appPackagesNeedsConfigurationDescription'),
      messageClassName: 'text-amber-800 dark:text-amber-200',
    };
  }
  return {
    className: appPackage.enabled
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : 'bg-muted text-muted-foreground',
    interactive: true,
    label: appPackage.enabled ? t('appPackagesEnabled') : t('appPackagesAvailable'),
  };
}
