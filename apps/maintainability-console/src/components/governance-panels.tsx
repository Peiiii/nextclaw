import type { MaintainabilityOverview } from "@shared/maintainability.types";
import { DirectoryHotspotList } from "./directory-hotspot-list";
import { MaintainabilityHotspotList } from "./maintainability-hotspot-list";
import { Panel } from "./panel";

type GovernancePanelsProps = {
  data: MaintainabilityOverview;
};

export function GovernancePanels({ data }: GovernancePanelsProps): JSX.Element {
  return (
    <>
      <section className="panel-grid panel-grid--two">
        <Panel
          eyebrow="Directory Pressure"
          title="目录压力"
          subtitle="目录预算警报，用来看哪些目录已经开始继续摊平或者偏离历史预算。"
        >
          <DirectoryHotspotList rows={data.directoryHotspots} />
        </Panel>

        <Panel
          eyebrow="Hotspot Freeze"
          title="维护性热点"
          subtitle="已经明确被冻结或需优先拆分的大文件，别再继续把复杂度灌进去。"
        >
          <MaintainabilityHotspotList rows={data.maintainabilityHotspots} />
        </Panel>
      </section>

      <section className="panel-grid">
        <Panel
          eyebrow="Scope Contract"
          title="扫描口径"
          subtitle="当前视图到底算了哪些目录、哪些后缀、排除了哪些产物目录。"
        >
          <div className="scope-contract">
            <div>
              <h3>包含路径</h3>
              <div className="scope-contract__chips">
                {data.scope.includePaths.map((item) => (
                  <span key={item} className="scope-contract__chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="scope-contract__row">
              <div>
                <h3>包含后缀</h3>
                <div className="scope-contract__chips">
                  {data.scope.includeExtensions.map((item) => (
                    <span key={item} className="scope-contract__chip scope-contract__chip--muted">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3>排除目录</h3>
                <div className="scope-contract__chips">
                  {data.scope.excludeDirs.map((item) => (
                    <span key={item} className="scope-contract__chip scope-contract__chip--muted">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </>
  );
}
