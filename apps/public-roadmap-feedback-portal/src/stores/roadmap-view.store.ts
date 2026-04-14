import { create } from "zustand";
import type {
  ItemSortMode,
  PublicItemType,
  PublicPhase,
  RoadmapViewMode
} from "@shared/public-roadmap-feedback-portal.types";

export type RoadmapPhaseFilter = PublicPhase | "all";
export type RoadmapTypeFilter = PublicItemType | "all";

export type RoadmapViewSnapshot = {
  viewMode: RoadmapViewMode;
  phaseFilter: RoadmapPhaseFilter;
  typeFilter: RoadmapTypeFilter;
  sortMode: ItemSortMode;
};

type RoadmapViewState = {
  snapshot: RoadmapViewSnapshot;
  setSnapshot: (patch: Partial<RoadmapViewSnapshot>) => void;
};

const initialSnapshot: RoadmapViewSnapshot = {
  viewMode: "board",
  phaseFilter: "all",
  typeFilter: "all",
  sortMode: "recent"
};

export const useRoadmapViewStore = create<RoadmapViewState>((set) => ({
  snapshot: initialSnapshot,
  setSnapshot: (patch) => set((state) => ({
    snapshot: {
      ...state.snapshot,
      ...patch
    }
  }))
}));
