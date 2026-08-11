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
  const headerTabs = (
    <Tabs value={activeTab} onValueChange={(value) => onActiveTabChange(value as AppsPanelTab)}>
      <TabsList className="grid h-auto w-[min(390px,100%)] grid-cols-3 rounded-lg bg-muted/70 p-0.5">
        <TabsTrigger value="apps" className="gap-1.5 px-2 py-1.5 text-xs">
          <Boxes className="h-3.5 w-3.5" />
          {t('appsTitle')}
        </TabsTrigger>
        <TabsTrigger value="panel-apps" className="gap-1.5 px-2 py-1.5 text-xs">
          <AppWindow className="h-3.5 w-3.5" />
          {t('panelAppsTitle')}
        </TabsTrigger>
        <TabsTrigger value="service-apps" className="gap-1.5 px-2 py-1.5 text-xs">
          <Server className="h-3.5 w-3.5" />
          {t('serviceAppsTitle')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <div className="h-full min-h-0 bg-white">
      {activeTab === 'apps' ? (
        <AppPackagesPanel headerContent={headerTabs} onOpenPanelApp={onOpenPanelApp} />
      ) : activeTab === 'panel-apps' ? (
        <PanelAppsList headerContent={headerTabs} onOpenPanelApp={onOpenPanelApp} />
      ) : (
        <ServiceAppsPanel headerContent={headerTabs} />
      )}
    </div>
  );
}
