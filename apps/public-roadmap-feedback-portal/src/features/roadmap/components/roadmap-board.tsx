import { PUBLIC_PHASES, type PublicItem } from "@shared/public-roadmap-feedback-portal.types";
import {
  PUBLIC_ITEM_TYPE_LABELS,
  PUBLIC_PHASE_LABELS,
  PUBLIC_PHASE_SUMMARIES
} from "../../../shared/portal-format.utils";
import { TagChip } from "../../../shared/components/tag-chip";

type RoadmapBoardProps = {
  items: PublicItem[];
  onOpenItem: (itemId: string) => void;
};

export function RoadmapBoard({ items, onOpenItem }: RoadmapBoardProps): JSX.Element {
  return (
    <div className="roadmap-board">
      {PUBLIC_PHASES.map((phase) => {
        const phaseItems = items.filter((item) => item.publicPhase === phase);
        return (
          <section key={phase} className="roadmap-column">
            <header>
              <span>{PUBLIC_PHASE_LABELS[phase]}</span>
              <strong>{phaseItems.length}</strong>
              <p>{PUBLIC_PHASE_SUMMARIES[phase]}</p>
            </header>
            <div className="roadmap-column__items">
              {phaseItems.length === 0 ? (
                <div className="empty-column">暂无公开事项</div>
              ) : phaseItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="item-card"
                  onClick={() => onOpenItem(item.id)}
                >
                  <div className="item-card__meta">
                    <TagChip tone="type">{PUBLIC_ITEM_TYPE_LABELS[item.type]}</TagChip>
                    <span>{item.engagement.voteCount} votes</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <span className="item-card__action">查看事项详情</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
