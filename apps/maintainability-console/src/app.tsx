import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MaintainabilityProfile } from "@shared/maintainability.types";
import { ConsoleHero } from "./components/console-hero";
import { DashboardContent } from "./components/dashboard-content";
import { maintainabilityApiService } from "./services/maintainability-api.service";

const PROFILE_LABELS: Record<MaintainabilityProfile, string> = {
  source: "Source",
  "repo-volume": "Repo Volume"
};

export default function App(): JSX.Element {
  const [profile, setProfile] = useState<MaintainabilityProfile>("source");
  const overviewQuery = useQuery({
    queryKey: ["maintainability-overview", profile],
    queryFn: async () => await maintainabilityApiService.getOverview(profile)
  });

  useEffect(() => {
    document.title = `Maintainability Console · ${PROFILE_LABELS[profile]}`;
  }, [profile]);

  return (
    <main className="console-shell">
      <div className="console-shell__backdrop" aria-hidden="true" />
      <div className="console-shell__content">
        <ConsoleHero
          profile={profile}
          data={overviewQuery.data}
          isRefreshing={overviewQuery.isFetching && !overviewQuery.isPending}
          isPending={overviewQuery.isPending}
          onProfileChange={setProfile}
          onRefresh={() => void overviewQuery.refetch()}
        />

        <DashboardContent
          data={overviewQuery.data}
          error={overviewQuery.error}
          isPending={overviewQuery.isPending}
          onRetry={() => void overviewQuery.refetch()}
        />
      </div>
    </main>
  );
}
