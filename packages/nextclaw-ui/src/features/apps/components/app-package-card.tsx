import { useState } from 'react';
import type { AppPackageView } from '@nextclaw/client-sdk';
import {
  AppWindow,
  Bookmark,
  CalendarDays,
  CheckSquare2,
  ChevronRight,
  MoreHorizontal,
  NotebookText,
  RefreshCw,
  RotateCcw,
  Server,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { getLanguage, t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

export function AppPackageCard({
  appPackage,
  isPending,
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
  onDisable: () => void;
  onEnable: () => void;
  onOpenPanelApp: (entry: PanelAppEntryView) => void;
  onRollback: (version: string) => void;
  onUninstall: () => void;
  onUpdate: () => void;
  panelApps: PanelAppEntryView[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const panelComponents = appPackage.components.filter((component) => component.kind === 'panel');
  const serviceCount = appPackage.components.length - panelComponents.length;
  const rollbackVersions = appPackage.installedVersions.filter(
    (version) => version !== appPackage.activeVersion,
  );
  const displayName = readLocalizedText(appPackage.name, appPackage.nameI18n);
  const displayDescription = readLocalizedText(
    appPackage.description,
    appPackage.descriptionI18n,
  );

  return (
    <Card surface="flat" hover={false} className="overflow-hidden">
      <div className="flex items-start gap-3 px-3.5 pb-3 pt-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AppWindow className="h-5 w-5" />
        </div>
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
            disabled={isPending}
            onClick={appPackage.enabled ? onDisable : onEnable}
          >
            {isPending
              ? t('appPackagesWorking')
              : appPackage.enabled
                ? t('appPackagesDisable')
                : t('appPackagesEnable')}
          </Button>
          {(!appPackage.builtIn || rollbackVersions.length > 0) ? (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t('appPackagesMoreActions')}
                  title={t('appPackagesMoreActions')}
                  disabled={isPending}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:opacity-50"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 rounded-xl p-1.5">
                {!appPackage.builtIn ? (
                  <AppPackageMenuItem
                    icon={RefreshCw}
                    label={t('appPackagesCheckUpdate')}
                    onClick={() => {
                      setMenuOpen(false);
                      onUpdate();
                    }}
                  />
                ) : null}
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
                {!appPackage.builtIn ? (
                  <AppPackageMenuItem
                    destructive
                    icon={Trash2}
                    label={t('appPackagesUninstall')}
                    onClick={() => {
                      setMenuOpen(false);
                      setUninstallOpen(true);
                    }}
                  />
                ) : null}
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

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
                  disabled={!appPackage.enabled || !panelApp || isPending}
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

      <ConfirmDialog
        open={uninstallOpen}
        onOpenChange={setUninstallOpen}
        title={t('appPackagesUninstallTitle')}
        description={t('appPackagesUninstallDescription')}
        confirmLabel={t('appPackagesUninstall')}
        variant="destructive"
        onConfirm={onUninstall}
        onCancel={() => undefined}
      />
    </Card>
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
  if (icon && !icon.startsWith('/') && !icon.includes('://')) {
    return <span className="text-sm leading-none">{icon}</span>;
  }
  return <Fallback className="h-3.5 w-3.5" />;
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
