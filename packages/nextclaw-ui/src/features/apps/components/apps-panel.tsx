import { useState } from 'react';
import { AppWindow, Boxes, Server } from 'lucide-react';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { AppPackagesPanel } from '@/features/apps/components/app-packages-panel';
import { PanelAppsList } from '@/features/panel-apps';
import { ServiceAppsPanel } from '@/features/service-apps';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { t } from '@/shared/lib/i18n';

export type AppsPanelTab = 'apps' | 'panel-apps' | 'service-apps';

export function AppsPanel({
  activeTab,
  onActiveTabChange,
  onOpenPanelApp,
}: {
  activeTab: AppsPanelTab;
  onActiveTabChange: (tab: AppsPanelTab) => void;
  onOpenPanelApp: (entry: PanelAppEntryView) => void;
}) {
  const [focusedPackageId, setFocusedPackageId] = useState<string>();
  const changeTab = (tab: AppsPanelTab) => {
    setFocusedPackageId(undefined);
    onActiveTabChange(tab);
  };
  const managePackage = (packageId: string) => {
    setFocusedPackageId(packageId);
    onActiveTabChange('apps');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-card text-card-foreground">
      <nav className="shrink-0 border-b border-border/70 px-4 py-3" aria-label={t('appsTitle')}>
        <Tabs value={activeTab} onValueChange={(value) => changeTab(value as AppsPanelTab)}>
          <TabsList className="grid h-auto w-full max-w-[390px] grid-cols-3 rounded-lg bg-muted/70 p-0.5">
            <TabsTrigger value="apps" className="min-w-0 gap-1.5 px-2 py-1.5 text-xs">
              <Boxes className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('appsTitle')}</span>
            </TabsTrigger>
            <TabsTrigger value="panel-apps" className="min-w-0 gap-1.5 px-2 py-1.5 text-xs">
              <AppWindow className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('panelAppsTitle')}</span>
            </TabsTrigger>
            <TabsTrigger value="service-apps" className="min-w-0 gap-1.5 px-2 py-1.5 text-xs">
              <Server className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('serviceAppsTitle')}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </nav>
      <div className="min-h-0 flex-1">
        {activeTab === 'apps' ? (
          <AppPackagesPanel focusedPackageId={focusedPackageId} onOpenPanelApp={onOpenPanelApp} />
        ) : activeTab === 'panel-apps' ? (
          <PanelAppsList onOpenPanelApp={onOpenPanelApp} />
        ) : (
          <ServiceAppsPanel onManagePackage={managePackage} />
        )}
      </div>
    </div>
  );
}
