import { useMemo, useState } from 'react';
import { MoreVertical, PanelLeft, PanelLeftDashed, RefreshCw } from 'lucide-react';
import { usePanelApps, useUpdatePanelAppPreferences } from '@/features/panel-apps/hooks/use-panel-apps';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { t } from '@/shared/lib/i18n';

type PanelAppToolbarProps = {
  appTitle: string;
  mainSidebar?: boolean;
  mainSidebarPending?: boolean;
  onRefresh: () => void;
  onToggleMainSidebar?: () => void;
};

export function PanelAppToolbar({
  appTitle,
  mainSidebar = false,
  mainSidebarPending = false,
  onRefresh,
  onToggleMainSidebar,
}: PanelAppToolbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mainSidebarLabel = mainSidebar
    ? t('panelAppsRemoveFromMainSidebar')
    : t('panelAppsAddToMainSidebar');

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-card px-3.5 py-2 shrink-0">
      <span
        className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground"
        title={appTitle}
      >
        {appTitle}
      </span>
      {onToggleMainSidebar ? (
        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <PopoverTrigger asChild>
            <IconActionButton
              icon={<MoreVertical className="h-3.5 w-3.5" />}
              label={t('panelAppsMoreActions')}
              size="sm"
            />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 rounded-xl p-1.5">
            <button
              type="button"
              disabled={mainSidebarPending}
              aria-pressed={mainSidebar}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setIsMenuOpen(false);
                onToggleMainSidebar();
              }}
            >
              {mainSidebar
                ? <PanelLeftDashed className="h-4 w-4 shrink-0" />
                : <PanelLeft className="h-4 w-4 shrink-0" />}
              <span>{mainSidebarLabel}</span>
            </button>
          </PopoverContent>
        </Popover>
      ) : null}
      <IconActionButton
        icon={<RefreshCw className="h-3.5 w-3.5" />}
        label={t('panelAppsRefreshCurrent')}
        onClick={onRefresh}
        size="sm"
      />
    </div>
  );
}

export function PanelAppDocBrowserToolbar({
  appId,
  appTitle,
  onRefresh,
}: {
  appId: string | null;
  appTitle: string;
  onRefresh: () => void;
}) {
  const panelApps = usePanelApps();
  const updatePreferences = useUpdatePanelAppPreferences();
  const entry = useMemo(
    () => panelApps.data?.entries.find((candidate) => candidate.appId === appId),
    [appId, panelApps.data?.entries],
  );

  return (
    <PanelAppToolbar
      appTitle={entry?.title ?? appTitle}
      mainSidebar={entry?.mainSidebar}
      mainSidebarPending={updatePreferences.isPending}
      onRefresh={onRefresh}
      onToggleMainSidebar={entry
        ? () => updatePreferences.mutate({
            id: entry.id,
            preferences: { mainSidebar: !entry.mainSidebar },
          })
        : undefined}
    />
  );
}
