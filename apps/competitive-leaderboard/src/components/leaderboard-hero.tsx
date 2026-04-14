import type { LeaderboardOverview } from "@shared/competitive-leaderboard.types";
import { formatDateTime } from "../lib/leaderboard-format.utils";

type LeaderboardHeroProps = {
  data: LeaderboardOverview | undefined;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function LeaderboardHero({
  data,
  isRefreshing,
  onRefresh
}: LeaderboardHeroProps): JSX.Element {
  return (
    <header className="hero">
      <div className="hero__copy">
        <div className="hero__eyebrow">ClawBoard · Lobster-Class Product Research Index</div>
        <h1>ClawBoard：龙虾类产品研究榜单</h1>
        <p className="hero__summary">
          这不是“把我们家排第一”的宣传页，而是一套公开方法论驱动的研究型榜单。
          我们只保留真正的龙虾类产品和直接衍生物，再只对真正同类的 core 层做统一总榜，并把公共信号和能力覆盖拆开给你看。
          对于通义、腾讯元器、有道云笔记 AI 这类高知名度但不适合混排的产品，我们也会明确写出“已审查但排除”的理由。
        </p>
        <div className="hero__meta">
          <span className="hero__meta-pill">Universe：{data?.summary.totalProducts ?? 0} 个产品</span>
          <span className="hero__meta-pill">Core：{data?.summary.coreComparableCount ?? 0} 个</span>
          <span className="hero__meta-pill">Watch：{data?.summary.watchCount ?? 0} 个</span>
          <span className="hero__meta-pill">证据条目：{data?.summary.evidenceCount ?? 0}</span>
          {data ? (
            <span className="hero__meta-pill">
              最近更新：{formatDateTime(data.generatedAt)} · {data.methodologyVersion}
            </span>
          ) : null}
          {isRefreshing ? <span className="hero__meta-pill hero__meta-pill--live">刷新中</span> : null}
        </div>
      </div>

      <div className="hero__sidebar">
        <div className="hero__stat-grid">
          <article className="hero__stat-card">
            <div className="hero__stat-value">{data?.summary.rankedCount ?? 0}</div>
            <div className="hero__stat-label">统一总榜样本</div>
          </article>
          <article className="hero__stat-card">
            <div className="hero__stat-value">40</div>
            <div className="hero__stat-label">公共信号分上限</div>
          </article>
          <article className="hero__stat-card">
            <div className="hero__stat-value">60</div>
            <div className="hero__stat-label">能力覆盖分上限</div>
          </article>
          <article className="hero__stat-card">
            <div className="hero__stat-value">官方源</div>
            <div className="hero__stat-label">唯一主要证据</div>
          </article>
        </div>

        <button type="button" className="hero__refresh-button" onClick={onRefresh}>
          {isRefreshing ? "刷新中..." : "刷新榜单"}
        </button>
      </div>
    </header>
  );
}
