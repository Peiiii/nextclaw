import type {
  BreakdownMetricRow,
  FileMetricRow,
  MaintainabilityOverview
} from "@shared/maintainability.types";
import { formatInteger, formatPercent } from "../lib/maintainability-format.utils";
import { MetricTable, type MetricTableColumn } from "./metric-table";
import { Panel } from "./panel";

const scopeColumns: MetricTableColumn<BreakdownMetricRow>[] = [
  {
    key: "name",
    header: "模块",
    render: (row) => (
      <div className="metric-table__primary">
        <span>{row.name}</span>
      </div>
    )
  },
  { key: "files", header: "文件数", align: "right", render: (row) => formatInteger(row.files) },
  { key: "codeLines", header: "代码行数", align: "right", render: (row) => formatInteger(row.codeLines) },
  { key: "sharePercent", header: "占比", align: "right", render: (row) => formatPercent(row.sharePercent) },
  {
    key: "averageCodeLinesPerFile",
    header: "平均/文件",
    align: "right",
    render: (row) => formatInteger(row.averageCodeLinesPerFile)
  }
];

const languageColumns: MetricTableColumn<BreakdownMetricRow>[] = [
  { key: "name", header: "语言", render: (row) => row.name },
  { key: "files", header: "文件数", align: "right", render: (row) => formatInteger(row.files) },
  { key: "codeLines", header: "代码行数", align: "right", render: (row) => formatInteger(row.codeLines) },
  { key: "sharePercent", header: "占比", align: "right", render: (row) => formatPercent(row.sharePercent) }
];

const fileColumns: MetricTableColumn<FileMetricRow>[] = [
  {
    key: "path",
    header: "文件",
    render: (row) => (
      <div className="metric-table__path-cell">
        <span className="metric-table__primary">{row.path}</span>
        <span className="metric-table__secondary">{row.scope}</span>
      </div>
    )
  },
  { key: "language", header: "语言", render: (row) => row.language },
  { key: "codeLines", header: "代码行数", align: "right", render: (row) => formatInteger(row.codeLines) },
  { key: "totalLines", header: "总行数", align: "right", render: (row) => formatInteger(row.totalLines) },
  { key: "sharePercent", header: "占比", align: "right", render: (row) => formatPercent(row.sharePercent ?? 0) }
];

type VolumePanelsProps = {
  data: MaintainabilityOverview;
};

export function VolumePanels({ data }: VolumePanelsProps): JSX.Element {
  return (
    <>
      <section className="panel-grid panel-grid--two">
        <Panel
          eyebrow="Scope Leaderboard"
          title="模块榜单"
          subtitle="每个模块的文件数量、代码量与占比。先看谁最大，再决定削哪里。"
        >
          <MetricTable
            rows={data.byScope.slice(0, 12)}
            columns={scopeColumns}
            rowKey={(row) => row.name}
            emptyMessage="当前没有模块统计数据。"
          />
        </Panel>

        <Panel
          eyebrow="Language Mix"
          title="语言分布"
          subtitle="用来判断复杂度主要积在哪一类文件里，而不是只盯总量。"
        >
          <MetricTable
            rows={data.byLanguage}
            columns={languageColumns}
            rowKey={(row) => row.name}
            emptyMessage="当前没有语言分布数据。"
          />
        </Panel>
      </section>

      <section className="panel-grid">
        <Panel
          eyebrow="Largest Files"
          title="大文件排行"
          subtitle="优先盯顶部文件，它们最容易藏住膨胀和补丁式累积。"
        >
          <MetricTable
            rows={data.largestFiles.slice(0, 14)}
            columns={fileColumns}
            rowKey={(row) => row.path}
            emptyMessage="当前没有文件级体积数据。"
          />
        </Panel>
      </section>
    </>
  );
}
