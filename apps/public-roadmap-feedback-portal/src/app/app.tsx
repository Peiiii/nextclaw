import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CommunityFeedbackSection } from "../features/community-feedback/components/community-feedback-section";
import { ItemDetailPanel } from "../features/item-detail/components/item-detail-panel";
import { OverviewSection } from "../features/overview/components/overview-section";
import { RoadmapSection } from "../features/roadmap/components/roadmap-section";
import { UpdatesSection } from "../features/updates/components/updates-section";
import { portalApiService, portalQueryKeys } from "../services/portal-api.service";
import { PortalSectionNav } from "../shared/components/portal-section-nav";
import { useCommunityFeedbackStore } from "../stores/community-feedback.store";
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
  const feedbackSortMode = useCommunityFeedbackStore((state) => state.snapshot.feedbackSortMode);
  const activeItemId = useItemDetailStore((state) => state.snapshot.activeItemId);
  const itemsQueryConfig = presenter.roadmapViewManager.getItemsQuery();

  const overviewQuery = useQuery({
    queryKey: portalQueryKeys.overview(),
    queryFn: portalApiService.getOverview
  });
  const itemsQuery = useQuery({
    queryKey: portalQueryKeys.items(itemsQueryConfig),
    queryFn: async () => await portalApiService.getItems(itemsQueryConfig)
  });
  const itemOptionsQuery = useQuery({
    queryKey: portalQueryKeys.itemOptions(),
    queryFn: async () => await portalApiService.getItems({
      phase: "all",
      type: "all",
      sort: "recent",
      view: "list"
    })
  });
  const feedbackQuery = useQuery({
    queryKey: portalQueryKeys.feedback({
      sort: feedbackSortMode
    }),
    queryFn: async () => await portalApiService.getFeedback({
      sort: feedbackSortMode
    })
  });
  const updatesQuery = useQuery({
    queryKey: portalQueryKeys.updates(),
    queryFn: portalApiService.getUpdates
  });
  const itemDetailQuery = useQuery({
    queryKey: portalQueryKeys.itemDetail(activeItemId),
    queryFn: async () => await portalApiService.getItemDetail(activeItemId ?? ""),
    enabled: Boolean(activeItemId)
  });

  useEffect(() => {
    document.title = "NextClaw Pulse · 公开路线图";
  }, []);

  return (
    <AppRoot>
      <OverviewSection data={overviewQuery.data} isPending={overviewQuery.isPending} />
      <PortalSectionNav />
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
      <CommunityFeedbackSection
        data={feedbackQuery.data}
        itemOptions={itemOptionsQuery.data}
        isPending={feedbackQuery.isPending || itemOptionsQuery.isPending}
        error={feedbackQuery.error ?? itemOptionsQuery.error}
        sortMode={feedbackSortMode}
        onRetry={() => {
          void feedbackQuery.refetch();
          void itemOptionsQuery.refetch();
        }}
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
