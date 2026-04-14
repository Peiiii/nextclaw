import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ItemDetailPanel } from "../features/item-detail/components/item-detail-panel";
import { OverviewSection } from "../features/overview/components/overview-section";
import { RoadmapSection } from "../features/roadmap/components/roadmap-section";
import { UpdatesSection } from "../features/updates/components/updates-section";
import { portalApiService } from "../services/portal-api.service";
import { useItemDetailStore } from "../stores/item-detail.store";
import { useRoadmapViewStore } from "../stores/roadmap-view.store";
import { AppRoot } from "./app-root";
import { usePortalPresenter } from "./portal-presenter.service";

export default function App(): JSX.Element {
  const presenter = usePortalPresenter();
  const viewMode = useRoadmapViewStore((state) => state.snapshot.viewMode);
  const phaseFilter = useRoadmapViewStore((state) => state.snapshot.phaseFilter);
  const typeFilter = useRoadmapViewStore((state) => state.snapshot.typeFilter);
  const sortMode = useRoadmapViewStore((state) => state.snapshot.sortMode);
  const activeItemId = useItemDetailStore((state) => state.snapshot.activeItemId);

  const overviewQuery = useQuery({
    queryKey: ["portal-overview"],
    queryFn: portalApiService.getOverview
  });
  const itemsQuery = useQuery({
    queryKey: ["portal-items", viewMode, phaseFilter, typeFilter, sortMode],
    queryFn: async () => await portalApiService.getItems(presenter.roadmapViewManager.getItemsQuery())
  });
  const updatesQuery = useQuery({
    queryKey: ["portal-updates"],
    queryFn: portalApiService.getUpdates
  });
  const itemDetailQuery = useQuery({
    queryKey: ["portal-item-detail", activeItemId],
    queryFn: async () => await portalApiService.getItemDetail(activeItemId ?? ""),
    enabled: Boolean(activeItemId)
  });

  useEffect(() => {
    document.title = "NextClaw Pulse · 公开路线图";
  }, []);

  return (
    <AppRoot>
      <OverviewSection data={overviewQuery.data} isPending={overviewQuery.isPending} />
      <RoadmapSection
        data={itemsQuery.data}
        error={itemsQuery.error}
        isPending={itemsQuery.isPending}
        viewMode={viewMode}
        phaseFilter={phaseFilter}
        typeFilter={typeFilter}
        sortMode={sortMode}
        onRetry={() => void itemsQuery.refetch()}
      />
      <UpdatesSection data={updatesQuery.data} isPending={updatesQuery.isPending} />
      <ItemDetailPanel
        data={itemDetailQuery.data}
        isOpen={Boolean(activeItemId)}
        isPending={itemDetailQuery.isPending}
      />
    </AppRoot>
  );
}
