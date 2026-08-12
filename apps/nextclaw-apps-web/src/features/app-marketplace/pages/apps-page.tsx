import { AppCard } from "@/features/app-marketplace/components/app-card.js";
import type {
  AppItemSummary,
  AppListResult,
} from "@/features/app-marketplace/types/app-marketplace.types.js";

export function AppsPage(props: {
  data: AppListResult | null;
  error: boolean;
  query: string;
  tag: string;
  onQueryChange: (value: string) => void;
  onNextPage: (cursor: string) => void;
  onRetry: () => void;
  onTagChange: (value: string) => void;
}) {
  return (
    <div className="page-stack">
      <section className="section-panel">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">应用库</p>
            <h1>为你的 NextClaw 添加能力</h1>
            <p>发现能进入日常使用、并清楚说明权限边界的应用。</p>
          </div>
          <span className="result-count">{props.data
            ? `${props.data.items.length} 个结果${props.data.hasMore ? "，还有更多" : ""}`
            : props.error ? "载入失败" : "正在载入"}</span>
        </div>
        <div className="catalog-toolbar">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="搜索应用"
              id="app-catalog-search"
              name="query"
              type="search"
              value={props.query}
              onChange={(event) => props.onQueryChange(event.target.value)}
              placeholder="搜索应用、功能或标签"
            />
          </label>
          <div className="category-chips" aria-label="应用分类">
            {CATEGORIES.map((category) => (
              <button
                type="button"
                key={category.value}
                className={props.tag === category.value ? "category-chip category-chip--active" : "category-chip"}
                onClick={() => props.onTagChange(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
        {props.error ? <div className="notice-state"><b>应用库暂时不可用</b><span>请检查网络后重试。</span><button type="button" className="button-link button-link--ghost" onClick={props.onRetry}>重新载入</button></div> : null}
        {!props.error && !props.data ? <div className="app-grid">{[0, 1, 2].map((item) => <div className="app-card app-card--skeleton" key={item} />)}</div> : null}
        {props.data?.items.length === 0 ? <div className="notice-state"><b>没有找到匹配的应用</b><span>换一个关键词或清除分类后再试。</span></div> : null}
        {props.data?.items.length ? <div className="app-grid">{props.data.items.map((item: AppItemSummary) => <AppCard key={item.id} item={item} />)}</div> : null}
        {props.data?.hasMore && props.data.nextCursor ? (
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

const CATEGORIES = [
  { label: "全部", value: "" },
  { label: "个人空间", value: "personal" },
  { label: "笔记与资料", value: "notes" },
  { label: "本机服务", value: "local" },
];
