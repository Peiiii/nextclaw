import { useMemo, useState } from 'react';
import { MoreVertical, RefreshCw } from 'lucide-react';
import { PanelAppMainSidebarMenuItem } from '@/features/panel-apps/components/panel-app-main-sidebar-menu-item';
import { usePanelApps } from '@/features/panel-apps/hooks/use-panel-apps';
import { readPanelAppIdFromTab } from '@/features/right-panel-resources';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

type PanelAppToolbarProps = {
  appTitle: string;
  entry?: PanelAppEntryView;
  onRefresh: () => void;
};

export function PanelAppToolbar({
  appTitle,
  entry,
  onRefresh,
}: PanelAppToolbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-card px-3.5 py-2 shrink-0">
      <span
        className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground"
        title={appTitle}
      >
        {appTitle}
      </span>
      {entry ? (
        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <PopoverTrigger asChild>
            <IconActionButton
              icon={<MoreVertical className="h-3.5 w-3.5" />}
              label={t('panelAppsMoreActions')}
              size="sm"
            />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 rounded-xl p-1.5">
            <PanelAppMainSidebarMenuItem
              entry={entry}
              onSelect={() => setIsMenuOpen(false)}
            />
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
  appTitle,
  currentUrl,
  onRefresh,
  resourceUri,
}: {
  appTitle: string;
  currentUrl: string;
  onRefresh: () => void;
  resourceUri?: string;
}) {
  const panelApps = usePanelApps();
  const appId = readPanelAppIdFromTab({ currentUrl, resourceUri });
  const entry = useMemo(
    () => panelApps.data?.entries.find((candidate) => candidate.appId === appId),
    [appId, panelApps.data?.entries],
  );

  return (
    <PanelAppToolbar
      appTitle={entry?.title ?? appTitle}
      entry={entry}
      onRefresh={onRefresh}
    />
  );
}
