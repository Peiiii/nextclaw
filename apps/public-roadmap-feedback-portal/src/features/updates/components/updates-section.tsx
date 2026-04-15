import type { UpdatesResponse } from "@shared/public-roadmap-feedback-portal.types";
import { formatPortalDate, PUBLIC_ITEM_TYPE_LABELS } from "../../../shared/portal-format.utils";
import { Panel } from "../../../shared/components/panel";
import { TagChip } from "../../../shared/components/tag-chip";

type UpdatesSectionProps = {
  data: UpdatesResponse | undefined;
  isPending: boolean;
};

export function UpdatesSection({ data, isPending }: UpdatesSectionProps): JSX.Element {
  return (
    <Panel id="updates" className="updates-panel portal-stage-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Shipped</p>
          <h2>近期已交付</h2>
        </div>
        <span className="panel-badge">Product progress</span>
      </div>
      <div className="updates-panel__body portal-stage-panel__body">
        {isPending ? (
          <div className="loading-block">正在加载已交付事项…</div>
        ) : (
          <div className="updates-timeline">
            {(data?.items ?? []).map((item) => (
              <article key={item.id} className="update-card">
                <time>{formatPortalDate(item.shippedAt ?? item.updatedAt)}</time>
                <div>
                  <TagChip tone="type">{PUBLIC_ITEM_TYPE_LABELS[item.type]}</TagChip>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
