import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AppDataEntry, AppPackageOperationView, AppPackageView } from '@nextclaw/client-sdk';
import { LoaderCircle, PackagePlus, RefreshCw, ShieldCheck } from 'lucide-react';
import { AppArtwork } from '@/features/apps/components/app-artwork';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { useAppPresenter } from '@/app/components/app-presenter-provider';
import { AppMarketplacePanel } from '@/features/apps/components/app-marketplace-panel';
import { AppPackageCard } from '@/features/apps/components/app-package-card';
import { AppRetainedDataSection, useAppData } from '@/features/app-data';
import {
  useAppPackageMutation,
  useAppPackageOperationSettlement,
  useAppPackageOperations,
  useAppPackages,
  isAppPackageOperationActive,
  type AppPackageMutationInput,
} from '@/features/apps/hooks/use-app-packages';
import { useGrantPanelAppClient, usePanelApps, useRecordPanelAppOpened } from '@/features/panel-apps';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { SkeletonContent } from '@/shared/components/ui/skeleton';
import { t } from '@/shared/lib/i18n';

export function AppPackagesPanel({
  focusedPackageId,
  marketplaceActive = false,
  onBrowseMarketplace,
  onManagePackage,
  onOpenPanelApp,
}: {
  focusedPackageId?: string;
  marketplaceActive?: boolean;
  onBrowseMarketplace: () => void;
  onManagePackage: (appId: string) => void;
  onOpenPanelApp: (entry: PanelAppEntryView) => void;
}) {
  const appPackages = useAppPackages();
  const appData = useAppData();
  const appPackageOperations = useAppPackageOperations();
  const panelApps = usePanelApps();
  const lifecycle = useAppPackageMutation();
  const recordOpened = useRecordPanelAppOpened();
  const grantClient = useGrantPanelAppClient();
  const presenter = useAppPresenter();
  const libraryTitleRef = useRef<HTMLHeadingElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installSource, setInstallSource] = useState('');

  const operations = useMemo(() => appPackageOperations.data?.entries ?? [], [appPackageOperations.data?.entries]);

  useEffect(() => {
    if (!focusedPackageId || appPackages.isLoading) return;
    const target = document.getElementById(`app-package-${focusedPackageId}`);
    target?.scrollIntoView({ block: 'nearest' });
    target?.focus({ preventScroll: true });
  }, [appPackages.data, appPackages.isLoading, focusedPackageId]);

  useAppPackageOperationSettlement({
    isLoaded: Boolean(appPackageOperations.data),
    operations,
    refetchPackages: appPackages.refetch,
    refetchPanels: panelApps.refetch,
    refetchAppData: appData.refetch,
    settlementManager: presenter.appPackageOperationSettlementManager,
  });

  const runMutation = (input: AppPackageMutationInput, onSuccess?: () => void) => {
    lifecycle.reset();
    lifecycle.mutate(input, { onSuccess });
  };

  const openPanelApp = async (entry: PanelAppEntryView) => {
    if (entry.clientDeclared && !entry.clientGranted) {
      const allowed = await presenter.serviceActionAuthorizationManager.requestAuthorization({
        panelAppId: entry.appId,
        actions: [
          {
            actionId: 'nextclaw.client',
            actionTitle: t('panelAppsClientGrantTitle'),
            actionDescription: t('panelAppsClientGrantDescription'),
            risk: 'dangerous',
          },
        ],
      });
      if (!allowed) return;
      await grantClient.mutateAsync(entry.appId);
    }
    try {
      onOpenPanelApp(await recordOpened.mutateAsync(entry.id));
    } catch {
      onOpenPanelApp(entry);
    }
  };

  const submitInstall = (event: FormEvent) => {
    event.preventDefault();
    const source = installSource.trim();
    if (!source) return;
    runMutation({ action: 'install', source }, () => {
      setInstallOpen(false);
      setInstallSource('');
    });
  };

  const refetch = () => {
    void appPackages.refetch();
    void appPackageOperations.refetch();
    void panelApps.refetch();
    void appData.refetch();
  };

  return (
    <div className="[container-type:inline-size] flex h-full min-h-0 flex-col bg-card text-card-foreground">
      <div hidden={marketplaceActive} className={marketplaceActive ? 'hidden' : 'custom-scrollbar min-h-0 flex-1 overflow-y-auto'}>
        <div className="mx-auto w-full max-w-3xl px-3 py-4 [@container(min-width:28rem)]:px-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <h1 ref={libraryTitleRef} tabIndex={-1} className="text-base font-semibold tracking-tight text-foreground">
              {t('appPackagesLibraryTitle')}
            </h1>
            <div className="flex items-center gap-2">
              <IconActionButton
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                label={t('appPackagesRefresh')}
                onClick={refetch}
              />
              <Button type="button" size="sm" onClick={onBrowseMarketplace}>
                <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                {t('appPackagesBrowse')}
              </Button>
            </div>
          </div>

          {lifecycle.isError ? (
            <div
              role="alert"
              className="mb-3 rounded-xl bg-destructive/8 px-3 py-2.5 text-xs leading-5 text-destructive ring-1 ring-destructive/15"
            >
              {lifecycle.error instanceof Error ? lifecycle.error.message : t('appPackagesActionFailed')}
            </div>
          ) : null}

          <AppPackageLibrary
            appDataEntries={appData.data?.entries ?? []}
            appDataLoading={appData.isLoading}
            appDataUnavailable={appData.isError}
            error={getPackageLoadError(appPackages.error, panelApps.error)}
            focusedPackageId={focusedPackageId}
            isLoading={appPackages.isLoading || panelApps.isLoading}
            isPending={lifecycle.isPending}
            mutationAppId={
              'appId' in (lifecycle.variables ?? {}) ? (lifecycle.variables as { appId: string }).appId : undefined
            }
            packages={appPackages.data?.entries ?? []}
            panelApps={panelApps.data?.entries ?? []}
            unavailablePackages={panelApps.data?.unavailablePackages ?? []}
            operations={operations}
            onInstall={onBrowseMarketplace}
            onMutate={runMutation}
            onOpenPanelApp={(entry) => void openPanelApp(entry)}
          />
          <AppRetainedDataSection
            diagnostics={appData.data?.diagnostics ?? []}
            entries={appData.data?.entries ?? []}
            error={appData.error}
            isLoading={appData.isLoading}
            onDeletionFocusReturn={() => libraryTitleRef.current?.focus()}
          />
        </div>
      </div>

      <div hidden={!marketplaceActive} className={marketplaceActive ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <AppMarketplacePanel
          sourceButtonRef={addButtonRef}
          onCustomInstall={() => { lifecycle.reset(); setInstallOpen(true); }}
          onManagePackage={onManagePackage}
          error={lifecycle.error instanceof Error ? lifecycle.error : null}
          hostTarget={appPackages.data?.hostTarget}
          installedPackages={appPackages.data?.entries ?? []}
          startingSource={lifecycle.variables?.action === 'install' ? lifecycle.variables.source : undefined}
          isStarting={lifecycle.isPending}
          operations={operations}
          active={marketplaceActive}
          onInstall={(source, registryUrl) =>
            runMutation({
              action: 'install',
              source,
              registryUrl,
            })
          }
          onUpdate={(appId) => runMutation({ action: 'update', appId })}
        />

      </div>

      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent
          className="max-w-md"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            addButtonRef.current?.focus();
          }}
        >
          <form onSubmit={submitInstall}>
            <DialogHeader showClose={false}>
              <DialogTitle>{t('appPackagesInstallTitle')}</DialogTitle>
              <DialogDescription>{t('appPackagesInstallDescription')}</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <Input
                autoFocus
                value={installSource}
                onChange={(event) => setInstallSource(event.target.value)}
                placeholder={t('appPackagesInstallPlaceholder')}
                aria-label={t('appPackagesInstallSource')}
              />
              <div className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t('appPackagesInstallTrustHint')}</span>
              </div>
              {lifecycle.isError ? (
                <p role="alert" className="text-xs text-destructive">
                  {lifecycle.error instanceof Error ? lifecycle.error.message : t('appPackagesActionFailed')}
                </p>
              ) : null}
            </div>
            <DialogFooter className="mt-5 gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setInstallOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={!installSource.trim() || lifecycle.isPending}>
                {lifecycle.isPending ? t('appPackagesInstalling') : t('appPackagesInstall')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AppPackageLibrary({
  appDataEntries,
  appDataLoading,
  appDataUnavailable,
  error,
  focusedPackageId,
  isLoading,
  isPending,
  mutationAppId,
  onInstall,
  onMutate,
  onOpenPanelApp,
  packages,
  panelApps,
  unavailablePackages,
  operations,
}: {
  appDataEntries: AppDataEntry[];
  appDataLoading: boolean;
  appDataUnavailable: boolean;
  error?: string;
  focusedPackageId?: string;
  isLoading: boolean;
  isPending: boolean;
  mutationAppId?: string;
  onInstall: () => void;
  onMutate: (input: AppPackageMutationInput) => void;
  onOpenPanelApp: (entry: PanelAppEntryView) => void;
  packages: AppPackageView[];
  panelApps: PanelAppEntryView[];
  unavailablePackages: Array<{ appId: string; message: string }>;
  operations: AppPackageOperationView[];
}) {
  if (isLoading) {
    return (
      <div className="divide-y divide-border/50" role="status" aria-label={t('appPackagesLoading')}>
        <SkeletonContent />
        <SkeletonContent />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (packages.length === 0) {
    const activeInstalls = operations.filter(
      (entry) => entry.action === 'install' && isAppPackageOperationActive(entry.status),
    );
    if (activeInstalls.length > 0) {
      return (
        <div className="divide-y divide-border/50">
          {activeInstalls.map((operation) => (
            <PendingInstallCard key={operation.id} operation={operation} />
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
        <PackagePlus className="h-7 w-7 text-muted-foreground" />
        <h2 className="mt-3 text-sm font-semibold text-foreground">{t('appPackagesEmptyTitle')}</h2>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{t('appPackagesEmptyDescription')}</p>
        <Button type="button" size="sm" className="mt-4" onClick={onInstall}>
          {t('appPackagesBrowse')}
        </Button>
      </div>
    );
  }
  return (
    <div className="divide-y divide-border/50">
      {operations
        .filter(
          (entry) =>
            entry.action === 'install' &&
            isAppPackageOperationActive(entry.status) &&
            !packages.some((appPackage) => appPackage.id === entry.appId),
        )
        .map((operation) => (
          <PendingInstallCard key={operation.id} operation={operation} />
        ))}
      {packages.map((appPackage) => {
        const latestOperation = operations.find((entry) => entry.appId === appPackage.id);
        const visibleOperation =
          latestOperation &&
          (isAppPackageOperationActive(latestOperation.status) ||
            latestOperation.status === 'failed' ||
            latestOperation.status === 'interrupted')
            ? latestOperation
            : undefined;

        return (
          <section
            key={appPackage.id}
            id={`app-package-${appPackage.id}`}
            aria-label={appPackage.name}
            tabIndex={-1}
            className={
              focusedPackageId === appPackage.id
                ? 'rounded-xl outline-none ring-2 ring-primary/35 ring-offset-2 ring-offset-background'
                : 'outline-none'
            }
          >
            <AppPackageCard
              appPackage={appPackage}
              unavailableMessage={unavailablePackages.find((entry) => entry.appId === appPackage.id)?.message}
              storageUsage={
                appDataEntries.find(
                  (entry) =>
                    entry.source === 'package' &&
                    entry.lifecycle === 'active' &&
                    entry.appId === appPackage.id &&
                    entry.instanceId === appPackage.instanceId,
                )?.usage ?? appPackage.storageUsage
              }
              storageUsageLoading={appDataLoading}
              storageUsageUnavailable={appDataUnavailable}
              panelApps={panelApps.filter((entry) => entry.packageId === appPackage.id)}
              isPending={isPending && mutationAppId === appPackage.id}
              operation={visibleOperation}
              onEnable={() => onMutate({ action: 'enable', appId: appPackage.id })}
              onDisable={() => onMutate({ action: 'disable', appId: appPackage.id })}
              onUpdate={() => onMutate({ action: 'update', appId: appPackage.id })}
              onRollback={(version) =>
                onMutate({
                  action: 'rollback',
                  appId: appPackage.id,
                  version,
                })
              }
              onUninstall={(purgeData) =>
                onMutate({
                  action: 'uninstall',
                  appId: appPackage.id,
                  purgeData,
                })
              }
              onOpenPanelApp={onOpenPanelApp}
            />
          </section>
        );
      })}
    </div>
  );
}

function PendingInstallCard({ operation }: { operation: AppPackageOperationView }) {
  const label = operation.appId ?? operation.source ?? t('appPackagesInstall');
  const progress = Math.max(4, Math.round((operation.completedSteps / operation.totalSteps) * 100));
  return (
    <div
      className="rounded-xl border border-border/60 bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.025)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <AppArtwork name={label} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            {operationProgressLabel(operation)}
          </p>
        </div>
      </div>
      <div className="ml-14 mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function operationProgressLabel(operation: AppPackageOperationView): string {
  switch (operation.status) {
    case 'queued':
      return t('appPackagesPreparing');
    case 'resolving':
      return t('appPackagesResolving');
    case 'downloading':
      return t('appPackagesDownloading');
    case 'verifying':
      return t('appPackagesVerifying');
    case 'installing':
      return t('appPackagesInstalling');
    case 'finalizing':
      return t('appPackagesFinalizing');
    case 'succeeded':
      return t('appPackagesCompleted');
    case 'failed':
    case 'interrupted':
      return operation.error ?? t('appPackagesActionFailed');
  }
}

function getPackageLoadError(...errors: unknown[]): string | undefined {
  const error = errors.find((candidate): candidate is Error => candidate instanceof Error);
  return error?.message || (errors.some(Boolean) ? t('appPackagesLoadFailed') : undefined);
}
