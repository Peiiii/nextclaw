import type { PublicItem } from "@shared/public-roadmap-feedback-portal.types";
import {
  formatPortalDate,
  PUBLIC_ITEM_TYPE_LABELS,
  PUBLIC_PHASE_LABELS
} from "../../../shared/portal-format.utils";
import { TagChip } from "../../../shared/components/tag-chip";

type RoadmapListProps = {
  items: PublicItem[];
  onOpenItem: (itemId: string) => void;
};

export function RoadmapList({ items, onOpenItem }: RoadmapListProps): JSX.Element {
  return (
    <div className="roadmap-list">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="roadmap-list-row"
          onClick={() => onOpenItem(item.id)}
        >
          <div>
            <div className="roadmap-list-row__chips">
              <TagChip tone="phase">{PUBLIC_PHASE_LABELS[item.publicPhase]}</TagChip>
              <TagChip tone="type">{PUBLIC_ITEM_TYPE_LABELS[item.type]}</TagChip>
            </div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
          </div>
          <div className="roadmap-list-row__signals">
            <strong>{item.engagement.voteCount}</strong>
            <span>votes</span>
            <em>{formatPortalDate(item.updatedAt)}</em>
          </div>
        </button>
      ))}
    </div>
  );
}
