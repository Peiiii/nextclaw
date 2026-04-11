import type { MaintainabilityOverview } from "@shared/maintainability.types";
import { GovernancePanels } from "./governance-panels";
import { OverviewStatGrid } from "./overview-stat-grid";
import { VolumePanels } from "./volume-panels";

type DashboardContentProps = {
  data: MaintainabilityOverview | undefined;
  error: unknown;
  isPending: boolean;
  onRetry: () => void;
};

export function DashboardContent({
  data,
  error,
  isPending,
  onRetry
}: DashboardContentProps): JSX.Element | null {
  if (isPending) {
    return (
      <section className="panel panel--loading">
        <div className="panel__loading-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="panel__skeleton" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel panel--error">
        <p className="panel__error-title">扫描失败</p>
        <p className="panel__error-text">
          {error instanceof Error ? error.message : "Maintainability overview 加载失败。"}
        </p>
        <button type="button" className="hero__refresh-button" onClick={onRetry}>
          重试
        </button>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <>
      <OverviewStatGrid data={data} />
      <VolumePanels data={data} />
      <GovernancePanels data={data} />
    </>
  );
}
