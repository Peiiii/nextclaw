import { Link } from "react-router-dom";
import { AppCard } from "@/features/app-marketplace/components/app-card.js";
import { AppCover } from "@/features/app-marketplace/components/app-cover.js";
import type { AppItemSummary } from "@/features/app-marketplace/types/app-marketplace.types.js";

export function HomePage({
  featuredApps,
  onRetry,
  status,
}: {
  featuredApps: AppItemSummary[];
  onRetry: () => void;
  status: "loading" | "ready" | "error";
}) {
  return (
    <div className="page-stack">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="hero-eyebrow"><span /> NextClaw 应用库</p>
          <h1>让 NextClaw，<span>长出新的空间与服务。</span></h1>
          <p>
            从整理待办和笔记，到连接本机资料。先看清应用会访问什么，再把它安全地装进自己的个人操作层。
          </p>
          <div className="hero-actions">
            <Link className="button-link" to="/apps">
              浏览应用 <span aria-hidden="true">→</span>
            </Link>
            <a className="button-link button-link--ghost" href="https://github.com/Peiiii/nextclaw" target="_blank" rel="noreferrer">
              了解 NextClaw
            </a>
          </div>
          <div className="hero-proof">
            <span>本机运行</span><span>权限透明</span><span>随时可卸载</span>
          </div>
        </div>
        <HeroShowcase app={featuredApps[0]} />
      </section>

      <section className="section-panel featured-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">精选应用</p>
            <h2>从真实需要出发</h2>
            <p>每个应用都说明用途、访问范围与安装方式。</p>
          </div>
          <Link className="text-link" to="/apps">查看全部 <span aria-hidden="true">→</span></Link>
        </div>
        {status === "loading" ? <div className="app-grid">{[0, 1, 2].map((item) => <div className="app-card app-card--skeleton" key={item} />)}</div> : null}
        {status === "error" ? <div className="notice-state"><b>暂时无法载入应用</b><span>请检查网络后重试。</span><button type="button" className="button-link button-link--ghost" onClick={onRetry}>重新载入</button></div> : null}
        {status === "ready" ? <div className="app-grid">{featuredApps.map((item) => <AppCard key={item.id} item={item} />)}</div> : null}
      </section>
    </div>
  );
}

function HeroShowcase({ app }: { app?: AppItemSummary }) {
  if (!app) {
    return <div className="hero-showcase hero-showcase--loading" aria-label="正在载入精选应用" />;
  }
  return (
    <Link className="hero-showcase" to={`/apps/${app.slug}`}>
      <AppCover
        accentColor={app.accentColor}
        className="hero-showcase__cover"
        coverUrl={app.coverUrl}
        name={app.name}
      />
      <span className="hero-showcase__scrim" />
      <span className="hero-showcase__content">
        <small>NextClaw 精选</small>
        <b>{app.name}</b>
        <span>{localizedSummary(app)}</span>
        <i>查看应用 <span aria-hidden="true">→</span></i>
      </span>
    </Link>
  );
}

function localizedSummary(item: AppItemSummary): string {
  return item.summaryI18n["zh-CN"] ?? item.summaryI18n.zh ?? item.summary;
}
