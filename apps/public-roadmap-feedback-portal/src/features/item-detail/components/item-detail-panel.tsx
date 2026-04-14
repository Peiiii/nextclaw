import type { PublicItemDetail } from "@shared/public-roadmap-feedback-portal.types";
import { usePortalPresenter } from "../../../app/portal-presenter.service";
import {
  formatPortalDate,
  PUBLIC_ITEM_TYPE_LABELS,
  PUBLIC_PHASE_LABELS
} from "../../../shared/portal-format.utils";
import { TagChip } from "../../../shared/components/tag-chip";

type ItemDetailPanelProps = {
  data: PublicItemDetail | undefined;
  isOpen: boolean;
  isPending: boolean;
};

export function ItemDetailPanel({ data, isOpen, isPending }: ItemDetailPanelProps): JSX.Element | null {
  const presenter = usePortalPresenter();

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="detail-panel" aria-label="路线图事项详情">
      <div className="detail-panel__scrim" onClick={() => presenter.itemDetailManager.closeItem()} />
      <section className="detail-panel__card">
        <button
          type="button"
          className="detail-panel__close"
          onClick={() => presenter.itemDetailManager.closeItem()}
        >
          关闭
        </button>
        {isPending ? (
          <div className="loading-block">正在加载事项详情…</div>
        ) : null}
        {data ? (
          <>
            <p className="eyebrow">路线图事项详情</p>
            <div className="detail-panel__chips">
              <TagChip tone="phase">{PUBLIC_PHASE_LABELS[data.item.publicPhase]}</TagChip>
              <TagChip tone="type">{PUBLIC_ITEM_TYPE_LABELS[data.item.type]}</TagChip>
              <TagChip tone="source">{data.item.sourceMetadata.sourceStatus}</TagChip>
            </div>
            <h2>{data.item.title}</h2>
            <p className="detail-panel__summary">{data.item.summary}</p>
            <p>{data.item.description}</p>
            <dl className="detail-panel__meta">
              <div>
                <dt>最近更新</dt>
                <dd>{formatPortalDate(data.item.updatedAt)}</dd>
              </div>
              <div>
                <dt>反馈信号</dt>
                <dd>{data.item.engagement.voteCount} votes · {data.item.engagement.linkedFeedbackCount} linked requests</dd>
              </div>
              <div>
                <dt>来源</dt>
                <dd>{data.item.sourceMetadata.sourceLabel}</dd>
              </div>
            </dl>
            {data.relatedItems.length > 0 ? (
              <div className="detail-panel__related">
                <h3>相关事项</h3>
                {data.relatedItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => presenter.itemDetailManager.openItem(item.id)}>
                    {item.title}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </aside>
  );
}
