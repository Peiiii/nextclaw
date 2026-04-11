import type { MaintainabilityOverview } from "@shared/maintainability.types";
import { formatDuration, formatInteger } from "../lib/maintainability-format.utils";
import { StatCard } from "./stat-card";

type OverviewStatGridProps = {
  data: MaintainabilityOverview;
};

export function OverviewStatGrid({ data }: OverviewStatGridProps): JSX.Element {
  return (
    <section className="stat-grid">
      <StatCard
        label="代码行数"
        value={formatInteger(data.totals.codeLines)}
        hint={`总代码量 / 总行数 ${formatInteger(data.totals.totalLines)}`}
        tone="sunrise"
      />
      <StatCard
        label="跟踪文件"
        value={formatInteger(data.totals.files)}
        hint={`平均 ${formatInteger(data.totals.codeLines / Math.max(data.totals.files, 1))} 行 / 文件`}
        tone="ocean"
      />
      <StatCard
        label="模块数"
        value={formatInteger(data.summary.moduleCount)}
        hint={`扫描 roots ${formatInteger(data.summary.scanRootCount)} 个`}
        tone="mint"
      />
      <StatCard
        label="扫描耗时"
        value={formatDuration(data.durationMs)}
        hint={`语言 ${formatInteger(data.summary.languageCount)} 种`}
        tone="violet"
      />
      <StatCard
        label="目录热点"
        value={formatInteger(data.summary.directoryHotspotCount)}
        hint="来自目录预算治理脚本"
        tone="amber"
      />
      <StatCard
        label="维护热点"
        value={formatInteger(data.summary.maintainabilityHotspotCount)}
        hint="来自长期冻结 / 热点清单"
        tone="rose"
      />
    </section>
  );
}
