import type { MaintainabilityHotspotRow } from "@shared/maintainability.types";
import { formatInteger } from "../lib/maintainability-format.utils";

type MaintainabilityHotspotListProps = {
  rows: MaintainabilityHotspotRow[];
};

export function MaintainabilityHotspotList({ rows }: MaintainabilityHotspotListProps): JSX.Element {
  if (rows.length === 0) {
    return <p className="metric-table__empty">当前没有维护性热点清单。</p>;
  }

  return (
    <div className="hotspot-list">
      {rows.map((row) => (
        <article key={`${row.chain}-${row.path}`} className="hotspot-list__item">
          <div className="hotspot-list__header">
            <div className="hotspot-list__path">{row.path}</div>
            <div className="hotspot-list__metrics">
              <span className="hotspot-list__chip">{row.chain}</span>
              {row.scope ? <span className="hotspot-list__chip hotspot-list__chip--scope">{row.scope}</span> : null}
            </div>
          </div>
          <div className="hotspot-list__body">
            <div>{row.rationale}</div>
            <div>推荐拆分缝：{row.nextSplitSeam}</div>
            <div className="hotspot-list__metrics">
              {row.currentLines !== null ? (
                <span className="hotspot-list__chip">当前行数 {formatInteger(row.currentLines)}</span>
              ) : null}
              {row.codeLines !== null ? (
                <span className="hotspot-list__chip">代码行数 {formatInteger(row.codeLines)}</span>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
