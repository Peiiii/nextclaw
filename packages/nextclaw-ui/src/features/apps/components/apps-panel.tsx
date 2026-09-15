import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AppWindow, Boxes, Server, Store } from 'lucide-react';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { AppPackagesPanel } from '@/features/apps/components/app-packages-panel';
import { PanelAppsList } from '@/features/panel-apps';
import { loadServiceAppsPanel } from '@/features/service-apps';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { t } from '@/shared/lib/i18n';

export type { RightPanelAppsTab as AppsPanelTab } from '@/features/right-panel-resources';
import type { RightPanelAppsTab as AppsPanelTab } from '@/features/right-panel-resources';

const ServiceAppsPanel = lazy(async () => ({
  default: (await loadServiceAppsPanel()).ServiceAppsPanel,
}));

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
  const navigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const revealSelectedTab = () => {
      const selected = navigation.querySelector('[aria-selected="true"]');
      if (!selected) return;
      const bounds = navigation.getBoundingClientRect();
      const tab = selected.getBoundingClientRect();
      if (tab.right > bounds.right) navigation.scrollLeft += tab.right - bounds.right + 12;
      else if (tab.left < bounds.left) navigation.scrollLeft -= bounds.left - tab.left + 12;
    };
    revealSelectedTab();
    const observer = new ResizeObserver(revealSelectedTab);
    observer.observe(navigation);
    return () => observer.disconnect();
  }, [activeTab]);
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
      <nav ref={navigationRef} className="custom-scrollbar shrink-0 overflow-x-auto border-b border-border/60 px-3 py-2" aria-label={t('appsTitle')}>
        <Tabs value={activeTab} onValueChange={(value) => changeTab(value as AppsPanelTab)}>
          <TabsList className="flex h-auto w-max flex-nowrap rounded-lg bg-transparent p-0.5 [&>button]:shrink-0">
            <TabsTrigger value="apps" className="min-w-0 gap-1.5 px-2 py-1.5 text-xs">
              <Boxes className="h-3.5 w-3.5 shrink-0" />
              <span>{t('appPackagesLibraryTitle')}</span>
            </TabsTrigger>
            <TabsTrigger value="panel-apps" className="min-w-0 gap-1.5 px-2 py-1.5 text-xs">
              <AppWindow className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('panelAppsTitle')}</span>
            </TabsTrigger>
            <TabsTrigger value="service-apps" className="min-w-0 gap-1.5 px-2 py-1.5 text-xs">
              <Server className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('serviceAppsTitle')}</span>
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="gap-1.5 px-2 py-1.5 text-xs">
              <Store className="h-3.5 w-3.5 shrink-0" />
              <span>{t('appPackagesMarketplaceTitle')}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </nav>
      <div className="min-h-0 flex-1">
        <div hidden={activeTab !== 'apps' && activeTab !== 'marketplace'} className={activeTab === 'apps' || activeTab === 'marketplace' ? 'h-full' : 'hidden'}>
          <AppPackagesPanel
            focusedPackageId={focusedPackageId}
            onOpenPanelApp={onOpenPanelApp}
            marketplaceActive={activeTab === 'marketplace'}
            onBrowseMarketplace={() => changeTab('marketplace')}
            onManagePackage={managePackage}
          />
        </div>
        {activeTab === 'panel-apps' ? (
          <PanelAppsList onOpenPanelApp={onOpenPanelApp} />
        ) : activeTab === 'service-apps' ? (
          <Suspense fallback={null}>
            <ServiceAppsPanel onManagePackage={managePackage} />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}
