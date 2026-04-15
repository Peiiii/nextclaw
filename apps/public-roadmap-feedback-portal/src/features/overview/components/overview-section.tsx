import type { PortalOverview } from "@shared/public-roadmap-feedback-portal.types";
import { Panel } from "../../../shared/components/panel";
import { StatCard } from "../../../shared/components/stat-card";

type OverviewSectionProps = {
  data: PortalOverview | undefined;
  isPending: boolean;
};

export function OverviewSection({ data, isPending }: OverviewSectionProps): JSX.Element {
  return (
    <Panel id="overview" className="overview-panel">
      <div className="overview-panel__copy">
        <p className="eyebrow">NextClaw Pulse</p>
        <h1>公开路线图与产品进展</h1>
        <p>
          一个面向用户的产品脉搏入口：展示正在规划、构建、验证和已交付的事项。
          现在已经同时覆盖官方路线图和社区反馈，让外部用户能看到进展、表达支持并直接提建议。
        </p>
        {data?.mode === "preview" ? (
          <div className="preview-banner">
            Preview mode · 当前使用显式预览数据与临时交互存储，并未连接真实 Linear / D1
          </div>
        ) : null}
        <div className="overview-panel__actions" aria-label="公开产品进展入口">
          <a href="#roadmap" className="portal-entry-card">
            <span>Explore</span>
            <strong>查看路线图</strong>
            <p>
              {isPending ? "…" : data?.summary.activeItems ?? 0} 个事项正在推进中，覆盖规划、构建与验证阶段。
            </p>
          </a>
          <a href="#community" className="portal-entry-card">
            <span>Feedback</span>
            <strong>参与反馈</strong>
            <p>
              用户可以直接投票、评论、提交建议，不需要进入内部 Linear。
            </p>
          </a>
          <a href="#updates" className="portal-entry-card">
            <span>Shipped</span>
            <strong>看最近交付</strong>
            <p>
              {isPending ? "…" : data?.summary.shippedItems ?? 0} 项已进入已交付阶段，帮助你快速判断推进速度。
            </p>
          </a>
        </div>
      </div>
      <div className="overview-panel__aside">
        <div className="overview-panel__stats">
          <StatCard
            label="公开事项"
            value={isPending ? "…" : data?.summary.totalItems ?? 0}
            detail="当前门户里可见的官方事项"
          />
          <StatCard
            label="正在推进"
            value={isPending ? "…" : data?.summary.activeItems ?? 0}
            detail="Considering 到 Reviewing 的事项"
          />
          <StatCard
            label="已交付"
            value={isPending ? "…" : data?.summary.shippedItems ?? 0}
            detail="进入 Shipped 的产品进展"
          />
          <StatCard
            label="反馈信号"
            value={isPending ? "…" : data?.summary.totalSignals ?? 0}
            detail="投票、评论与关联建议的总信号"
          />
          <StatCard
            label="社区建议"
            value={isPending ? "…" : data?.summary.totalFeedback ?? 0}
            detail="已公开提交的建议数"
          />
        </div>
        <article className="overview-panel__north-star">
          <span>North Star</span>
          <strong>NextClaw 正在成为 AI 时代的个人操作层。</strong>
          <p>
            这个页面不是单纯的任务清单，而是一个公开产品进展入口：
            让外部用户看到方向、理解进展，并直接参与反馈。
          </p>
          <div className="overview-panel__north-star-list">
            <span>官方路线图</span>
            <span>社区反馈</span>
            <span>近期交付</span>
          </div>
        </article>
      </div>
    </Panel>
  );
}
