import type {
  ItemsQuery,
  ItemSortMode,
  PublicItemType,
  PublicPhase,
  RoadmapViewMode
} from "@shared/public-roadmap-feedback-portal.types";
import { useRoadmapViewStore, type RoadmapPhaseFilter, type RoadmapTypeFilter } from "../stores/roadmap-view.store";

export class RoadmapViewManager {
  setViewMode = (viewMode: RoadmapViewMode): void => {
    useRoadmapViewStore.getState().setSnapshot({ viewMode });
  };

  setPhaseFilter = (phaseFilter: RoadmapPhaseFilter): void => {
    useRoadmapViewStore.getState().setSnapshot({ phaseFilter });
  };

  setTypeFilter = (typeFilter: RoadmapTypeFilter): void => {
    useRoadmapViewStore.getState().setSnapshot({ typeFilter });
  };

  setSortMode = (sortMode: ItemSortMode): void => {
    useRoadmapViewStore.getState().setSnapshot({ sortMode });
  };

  getItemsQuery = (): ItemsQuery => {
    const { snapshot } = useRoadmapViewStore.getState();
    return {
      phase: snapshot.phaseFilter as PublicPhase | "all",
      type: snapshot.typeFilter as PublicItemType | "all",
      sort: snapshot.sortMode,
      view: snapshot.viewMode
    };
  };
}
