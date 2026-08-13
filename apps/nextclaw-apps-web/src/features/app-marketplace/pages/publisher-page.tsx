import { AppCard } from "@/features/app-marketplace/components/app-card.js";
import type {
  AppItemSummary,
  AppListResult,
} from "@/features/app-marketplace/types/app-marketplace.types.js";

export function PublisherPage(props: {
  publisherId: string;
  data: AppListResult | null;
  onNextPage: (cursor: string) => void;
  onRetry: () => void;
  status: "loading" | "ready" | "error";
}) {
  return (
    <div className="page-stack page-stack--catalog">
      <section className="section-panel">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">发布者</p>
            <h1>{props.publisherId}</h1>
            <p>来自这个发布者的应用。</p>
          </div>
        </div>
        {props.status === "loading" ? <div className="notice-state">正在载入应用…</div> : null}
        {props.status === "error" ? <div className="notice-state"><b>暂时无法载入这个发布者</b><button type="button" className="button-link button-link--ghost" onClick={props.onRetry}>重新载入</button></div> : null}
        {props.status === "ready" ? <div className="app-grid">
          {props.data?.items.map((item: AppItemSummary) => (
            <AppCard key={item.id} item={item} />
          ))}
        </div> : null}
        {props.status === "ready" && props.data?.hasMore && props.data.nextCursor ? (
          <div className="catalog-pagination">
            <button
              type="button"
              className="button-link button-link--ghost"
              onClick={() => props.onNextPage(props.data?.nextCursor ?? "")}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
