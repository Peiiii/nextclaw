import type { AppPackageOperationView } from '@nextclaw/client-sdk';
import { toast } from 'sonner';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import { t } from '@/shared/lib/i18n';
import { isAppPackageOperationActive } from '@/features/apps/hooks/use-app-packages';

type RefetchPanels = () => Promise<{
  data?: { entries: Array<{ id: string; packageId?: string }> };
}>;

export class AppPackageOperationSettlementManager {
  private initialized = false;
  private readonly knownTerminalOperationIds = new Set<string>();

  constructor(private readonly docBrowserManager: DocBrowserManager) {}

  readonly settle = ({
    isLoaded,
    operations,
    refetchPackages,
    refetchPanels,
    refetchAppData,
  }: {
    isLoaded: boolean;
    operations: AppPackageOperationView[];
    refetchPackages: () => Promise<unknown>;
    refetchPanels: RefetchPanels;
    refetchAppData: () => Promise<unknown>;
  }): void => {
    if (!isLoaded) return;
    const terminal = operations.filter(
      (entry) => !isAppPackageOperationActive(entry.status),
    );
    if (!this.initialized) {
      terminal.forEach((entry) => this.knownTerminalOperationIds.add(entry.id));
      this.initialized = true;
      return;
    }
    terminal.forEach((operation) => {
      if (this.knownTerminalOperationIds.has(operation.id)) return;
      this.knownTerminalOperationIds.add(operation.id);
      this.settleOperation(operation, refetchPackages, refetchPanels, refetchAppData);
    });
  };

  private readonly settleOperation = (
    operation: AppPackageOperationView,
    refetchPackages: () => Promise<unknown>,
    refetchPanels: RefetchPanels,
    refetchAppData: () => Promise<unknown>,
  ): void => {
    if (operation.status === 'succeeded') {
      toast.success(operationSuccessLabel(operation));
      void refetchPackages();
      void refetchAppData();
      void refetchPanels().then((panelsResult) => {
        if (operation.action !== 'rollback' && operation.action !== 'update') return;
        this.docBrowserManager.reloadByDedupeKeys(
          panelsResult.data?.entries
            .filter((entry) => entry.packageId === operation.appId)
            .map((entry) => `panel-app:${entry.id}`) ?? [],
        );
      });
      return;
    }
    if (operation.status === 'failed' || operation.status === 'interrupted') {
      void refetchPackages();
      void refetchPanels();
      void refetchAppData();
      toast.error(operation.error ?? t('appPackagesActionFailed'));
    }
  };
}

function operationSuccessLabel(operation: AppPackageOperationView): string {
  switch (operation.action) {
    case 'install': return t('appPackagesInstallCompleted');
    case 'update': return operation.result?.changed === false
      ? t('appPackagesAlreadyCurrent')
      : t('appPackagesUpdateCompleted');
    case 'rollback': return operation.result?.changed === false
      ? t('appPackagesAlreadyOnVersion')
      : t('appPackagesRollbackCompleted');
    case 'uninstall': return t('appPackagesUninstallCompleted');
  }
}
