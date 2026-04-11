import type { DirectoryBudgetHotspot } from "@shared/maintainability.types";
import { formatInteger } from "../lib/maintainability-format.utils";

type DirectoryHotspotListProps = {
  rows: DirectoryBudgetHotspot[];
};

export function DirectoryHotspotList({ rows }: DirectoryHotspotListProps): JSX.Element {
  if (rows.length === 0) {
    return <p className="metric-table__empty">当前没有目录预算热点，说明目录平铺度暂时没有新的显著报警。</p>;
  }

  return (
    <div className="hotspot-list">
      {rows.map((row) => (
        <article key={`${row.path}-${row.budget}`} className="hotspot-list__item">
          <div className="hotspot-list__header">
            <div className="hotspot-list__path">{row.path}</div>
            <span className={`hotspot-list__chip hotspot-list__chip--${row.level}`}>
              {row.level === "error" ? "Error" : "Warn"} · {row.budget}
            </span>
          </div>
          <div className="hotspot-list__body">
            <div>{row.message}</div>
            <div className="hotspot-list__metrics">
              <span className="hotspot-list__chip">当前文件数 {formatInteger(row.currentCount)}</span>
              {row.previousCount !== null ? (
                <span className="hotspot-list__chip">历史基线 {formatInteger(row.previousCount)}</span>
              ) : null}
              {row.deltaCount !== null ? (
                <span className="hotspot-list__chip">变化 {formatInteger(row.deltaCount)}</span>
              ) : null}
              {row.exceptionStatus !== "missing" ? (
                <span className="hotspot-list__chip">例外状态 {row.exceptionStatus}</span>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
