import {
  PUBLIC_ITEM_TYPES,
  PUBLIC_PHASES,
  type ItemsResponse,
  type ItemSortMode,
  type PublicItemType,
  type PublicPhase,
  type RoadmapViewMode
} from "@shared/public-roadmap-feedback-portal.types";
import { usePortalPresenter } from "../../../app/portal-presenter.service";
import {
  PUBLIC_ITEM_TYPE_LABELS,
  PUBLIC_PHASE_LABELS
} from "../../../shared/portal-format.utils";
import { Panel } from "../../../shared/components/panel";
import { RoadmapBoard } from "./roadmap-board";
import { RoadmapList } from "./roadmap-list";

type RoadmapSectionProps = {
  data: ItemsResponse | undefined;
  error: unknown;
  isPending: boolean;
  viewMode: RoadmapViewMode;
  phaseFilter: PublicPhase | "all";
  typeFilter: PublicItemType | "all";
  sortMode: ItemSortMode;
  onRetry: () => void;
};

export function RoadmapSection(props: RoadmapSectionProps): JSX.Element {
  const presenter = usePortalPresenter();
  const items = props.data?.items ?? [];

  return (
    <Panel id="roadmap" className="roadmap-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Roadmap</p>
          <h2>公开阶段视图</h2>
        </div>
        <div className="view-toggle" aria-label="路线图视图切换">
          <button
            type="button"
            className={props.viewMode === "board" ? "is-active" : ""}
            onClick={() => presenter.roadmapViewManager.setViewMode("board")}
          >
            Board
          </button>
          <button
            type="button"
            className={props.viewMode === "list" ? "is-active" : ""}
            onClick={() => presenter.roadmapViewManager.setViewMode("list")}
          >
            List
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <label>
          阶段
          <select
            value={props.phaseFilter}
            onChange={(event) => presenter.roadmapViewManager.setPhaseFilter(event.target.value as PublicPhase | "all")}
          >
            <option value="all">全部阶段</option>
            {PUBLIC_PHASES.map((phase) => (
              <option key={phase} value={phase}>{PUBLIC_PHASE_LABELS[phase]}</option>
            ))}
          </select>
        </label>
        <label>
          类型
          <select
            value={props.typeFilter}
            onChange={(event) => presenter.roadmapViewManager.setTypeFilter(event.target.value as PublicItemType | "all")}
          >
            <option value="all">全部类型</option>
            {PUBLIC_ITEM_TYPES.map((type) => (
              <option key={type} value={type}>{PUBLIC_ITEM_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </label>
        <label>
          排序
          <select
            value={props.sortMode}
            onChange={(event) => presenter.roadmapViewManager.setSortMode(event.target.value as ItemSortMode)}
          >
            <option value="recent">最近更新</option>
            <option value="hot">热度优先</option>
          </select>
        </label>
      </div>

      {props.isPending ? (
        <div className="loading-block">正在加载公开路线图…</div>
      ) : null}

      {props.error ? (
        <div className="error-block">
          <strong>路线图加载失败</strong>
          <p>{props.error instanceof Error ? props.error.message : "Unknown roadmap error."}</p>
          <button type="button" onClick={props.onRetry}>重试</button>
        </div>
      ) : null}

      {!props.isPending && !props.error ? (
        props.viewMode === "board"
          ? <RoadmapBoard items={items} onOpenItem={presenter.itemDetailManager.openItem} />
          : <RoadmapList items={items} onOpenItem={presenter.itemDetailManager.openItem} />
      ) : null}
    </Panel>
  );
}
