import { useState } from 'react';
import type { AppPackageOperationView, AppPackageView } from '@nextclaw/client-sdk';
import {
  AlertCircle,
  AppWindow,
  Bookmark,
  CalendarDays,
  Check,
  CheckSquare2,
  ChevronRight,
  MoreHorizontal,
  NotebookText,
  RefreshCw,
  RotateCcw,
  Server,
  Trash2,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';
import { AppArtwork } from '@/features/apps/components/app-artwork';
import { isAppPackageOperationActive } from '@/features/apps/hooks/use-app-packages';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { getLanguage, t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

export function AppPackageCard({
  appPackage,
  isPending,
  operation,
  onDisable,
  onEnable,
  onOpenPanelApp,
  onRollback,
  onUninstall,
  onUpdate,
  panelApps,
}: {
  appPackage: AppPackageView;
  isPending: boolean;
  operation?: AppPackageOperationView;
  onDisable: () => void;
  onEnable: () => void;
  onOpenPanelApp: (entry: PanelAppEntryView) => void;
  onRollback: (version: string) => void;
  onUninstall: (purgeData: boolean) => void;
  onUpdate: () => void;
  panelApps: PanelAppEntryView[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [purgeData, setPurgeData] = useState(false);
  const panelComponents = appPackage.components.filter((component) => component.kind === 'panel');
  const serviceCount = appPackage.components.length - panelComponents.length;
  const rollbackVersions = appPackage.installedVersions.filter(
    (version) => version !== appPackage.activeVersion,
  );
  const displayName = readLocalizedText(appPackage.name, appPackage.nameI18n) ?? appPackage.id;
  const displayDescription = readLocalizedText(
    appPackage.description,
    appPackage.descriptionI18n,
  );
  const operationActive = operation ? isAppPackageOperationActive(operation.status) : false;
  const pending = isPending || operationActive;

  return (
    <Card surface="flat" hover={false} className="overflow-hidden border-border/60 shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
      <div className="flex items-start gap-3.5 px-4 pb-3.5 pt-4">
        <AppArtwork icon={appPackage.icon} name={displayName} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-foreground">{displayName}</h2>
            <span className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
              appPackage.enabled
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground',
            )}>
              {appPackage.enabled ? t('appPackagesEnabled') : t('appPackagesAvailable')}
            </span>
          </div>
          {displayDescription ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {displayDescription}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/75">
            <span>v{appPackage.activeVersion}</span>
            {appPackage.builtIn ? <span>{t('appPackagesBuiltIn')}</span> : null}
            {serviceCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Server className="h-3 w-3" />
                {t('appPackagesLocalService')}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={appPackage.enabled ? 'outline' : 'default'}
            disabled={pending}
            onClick={appPackage.enabled ? onDisable : onEnable}
          >
            {renderPrimaryActionLabel({
              enabled: appPackage.enabled,
              isPending,
              operation,
              operationActive,
            })}
          </Button>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t('appPackagesMoreActions')}
                  title={t('appPackagesMoreActions')}
                  disabled={pending}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:opacity-50"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 rounded-xl p-1.5">
                <AppPackageMenuItem
                  icon={RefreshCw}
                  label={t('appPackagesCheckUpdate')}
                  onClick={() => {
                    setMenuOpen(false);
                    onUpdate();
                  }}
                />
                {rollbackVersions.map((version) => (
                  <AppPackageMenuItem
                    key={version}
                    icon={RotateCcw}
                    label={`${t('appPackagesRollback')} v${version}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onRollback(version);
                    }}
                  />
                ))}
                <AppPackageMenuItem
                  destructive
                  icon={Trash2}
                  label={t('appPackagesUninstall')}
                  onClick={() => {
                    setMenuOpen(false);
                    setUninstallOpen(true);
                  }}
                />
              </PopoverContent>
            </Popover>
        </div>
      </div>

      {operation && (operationActive || operation.status === 'failed' || operation.status === 'interrupted') ? (
        <PackageOperationStatus operation={operation} />
      ) : null}

      {panelComponents.length > 0 ? (
        <div className="border-t border-border/60 bg-muted/20 p-2">
          <div className="grid grid-cols-2 gap-1.5">
            {panelComponents.map((component) => {
              const panelApp = panelApps.find((entry) => entry.appId === component.id);
              const Icon = resolveComponentIcon(component.id);
              const componentTitle = readLocalizedText(component.title, component.titleI18n)
                ?? component.id;
              return (
                <button
                  key={component.id}
                  type="button"
                  disabled={!appPackage.enabled || !panelApp || pending}
                  onClick={() => panelApp && onOpenPanelApp({
                    ...panelApp,
                    title: componentTitle,
                    description: readLocalizedText(
                      component.description,
                      component.descriptionI18n,
                    ),
                  })}
                  className="group flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-default disabled:opacity-55"
                  title={!appPackage.enabled ? t('appPackagesEnableToOpen') : componentTitle}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm ring-1 ring-border/60">
                    <ComponentIcon icon={component.icon} fallback={Icon} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {componentTitle}
                  </span>
                  {appPackage.enabled ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <Dialog open={uninstallOpen} onOpenChange={setUninstallOpen}>
        <DialogContent className="max-w-md [&>:last-child]:hidden">
          <DialogHeader>
            <DialogTitle>{t('appPackagesUninstallTitle')}</DialogTitle>
            <DialogDescription>{t('appPackagesUninstallDescription')}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-2">
            <DataChoice
              checked={!purgeData}
              description={t('appPackagesKeepDataDescription')}
              label={t('appPackagesKeepData')}
              onClick={() => setPurgeData(false)}
            />
            <DataChoice
              checked={purgeData}
              destructive
              description={t('appPackagesDeleteDataDescription')}
              label={t('appPackagesDeleteData')}
              onClick={() => setPurgeData(true)}
            />
          </div>
          <DialogFooter className="mt-5 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setUninstallOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onUninstall(purgeData);
                setUninstallOpen(false);
              }}
            >
              {t('appPackagesUninstall')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function renderPrimaryActionLabel({
  enabled,
  isPending,
  operation,
  operationActive,
}: {
  enabled: boolean;
  isPending: boolean;
  operation?: AppPackageOperationView;
  operationActive: boolean;
}) {
  if (operationActive) {
    return (
      <>
        <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        {operation ? operationLabel(operation) : t('appPackagesWorking')}
      </>
    );
  }
  if (isPending) return t('appPackagesWorking');
  return enabled ? t('appPackagesDisable') : t('appPackagesEnable');
}

function DataChoice({
  checked,
  description,
  destructive = false,
  label,
  onClick,
}: {
  checked: boolean;
  description: string;
  destructive?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border',
        checked ? 'border-foreground/25 bg-muted/55' : 'border-border/60 hover:bg-muted/35',
      )}
    >
      <span className={cn(
        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
        checked ? 'border-foreground bg-foreground text-background' : 'border-border',
      )}>
        {checked ? <Check className="h-2.5 w-2.5" /> : null}
      </span>
      <span>
        <span className={cn('block text-sm font-medium', destructive ? 'text-destructive' : 'text-foreground')}>{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function AppPackageMenuItem({
  destructive = false,
  icon: Icon,
  label,
  onClick,
}: {
  destructive?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:bg-[var(--interaction-hover)] hover:text-accent-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function ComponentIcon({
  fallback: Fallback,
  icon,
}: {
  fallback: LucideIcon;
  icon?: string;
}) {
  if (icon && (
    icon.startsWith('data:') ||
    icon.startsWith('/') ||
    icon.startsWith('http://') ||
    icon.startsWith('https://')
  )) {
    return <img src={icon} alt="" className="h-4 w-4 rounded object-cover" />;
  }
  if (icon) {
    return <span className="text-sm leading-none">{icon}</span>;
  }
  return <Fallback className="h-3.5 w-3.5" />;
}

function PackageOperationStatus({ operation }: { operation: AppPackageOperationView }) {
  const failed = operation.status === 'failed' || operation.status === 'interrupted';
  const progress = Math.max(4, Math.round((operation.completedSteps / operation.totalSteps) * 100));
  return (
    <div className="border-t border-border/50 px-4 py-2.5" role={failed ? 'alert' : 'status'} aria-live="polite">
      <div className="flex items-center gap-2 text-[11px]">
        {failed ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> : <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />}
        <span className={failed ? 'text-destructive' : 'text-muted-foreground'}>
          {failed ? operation.error ?? t('appPackagesActionFailed') : operationLabel(operation)}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', failed ? 'bg-destructive' : 'bg-primary')}
          style={{ width: failed ? '100%' : `${progress}%` }}
        />
      </div>
    </div>
  );
}

function operationLabel(operation: AppPackageOperationView): string {
  switch (operation.status) {
    case 'queued': return t('appPackagesPreparing');
    case 'resolving': return t('appPackagesResolving');
    case 'downloading': return t('appPackagesDownloading');
    case 'verifying': return t('appPackagesVerifying');
    case 'installing': return operation.action === 'rollback'
      ? `${t('appPackagesSwitchingVersion')} ${operation.targetVersion ? `v${operation.targetVersion}` : ''}`.trim()
      : operation.action === 'uninstall'
        ? t('appPackagesUninstalling')
        : t('appPackagesInstalling');
    case 'finalizing': return t('appPackagesFinalizing');
    case 'succeeded': return t('appPackagesCompleted');
    case 'failed':
    case 'interrupted': return t('appPackagesActionFailed');
  }
}

function resolveComponentIcon(componentId: string): LucideIcon {
  if (componentId.endsWith('-todos')) return CheckSquare2;
  if (componentId.endsWith('-notes')) return NotebookText;
  if (componentId.endsWith('-favorites')) return Bookmark;
  if (componentId.endsWith('-calendar')) return CalendarDays;
  return AppWindow;
}

function readLocalizedText(
  fallback: string | undefined,
  localized: Record<string, string> | undefined,
): string | undefined {
  const languageTag = getLanguage() === 'zh' ? 'zh-CN' : 'en-US';
  return localized?.[languageTag] ?? fallback;
}
