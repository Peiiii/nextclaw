import { Link } from "react-router-dom";
import type { AppItemSummary } from "../app.types.js";
import { AppCard } from "../components/app-card.js";

export function HomePage({ featuredApps }: { featuredApps: AppItemSummary[] }) {
  return (
    <div className="page-stack">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="hero-eyebrow">NextClaw Apps</p>
          <h1>轻量、可分发、可本地运行的 NextClaw 应用形态。</h1>
          <p>
            用 web coding 做 app，用 <code>napp publish</code> 发布，用独立 app
            store 分发，用本地 runtime 安装和运行。
          </p>
          <div className="hero-actions">
            <Link className="button-link" to="/apps">
              浏览 Apps
            </Link>
            <a className="button-link button-link--ghost" href="https://github.com/Peiiii/nextclaw">
              开发者入口
            </a>
          </div>
        </div>
        <div className="hero-panel">
          <p className="hero-panel__label">Install</p>
          <code>npm install -g @nextclaw/app-runtime</code>
          <p className="hero-panel__label">Run</p>
          <code>napp install nextclaw.hello-notes</code>
        </div>
      </section>

      <section className="section-panel">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Featured</p>
            <h2>官方精选 Apps</h2>
          </div>
          <Link to="/apps">查看全部</Link>
        </div>
        <div className="app-grid">
          {featuredApps.map((item) => (
            <AppCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
