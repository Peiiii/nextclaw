import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProductDetail } from "@shared/competitive-leaderboard.types";
import { EvidenceDrawer } from "./components/evidence-drawer";
import { LeaderboardHero } from "./components/leaderboard-hero";
import { MethodologyPanel } from "./components/methodology-panel";
import { ProductProfileGrid } from "./components/product-profile-grid";
import { RankingBoard } from "./components/ranking-board";
import { SubRankingBoard } from "./components/sub-ranking-board";
import { UniverseMap } from "./components/universe-map";
import { leaderboardApiService } from "./services/leaderboard-api.service";

export default function App(): JSX.Element {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const overviewQuery = useQuery({
    queryKey: ["competitive-leaderboard"],
    queryFn: async () => await leaderboardApiService.getOverview()
  });

  useEffect(() => {
    document.title = "ClawBoard | 龙虾类产品研究榜单";
  }, []);

  const activeDetail: ProductDetail | null = overviewQuery.data && selectedProductId
    ? overviewQuery.data.productDetails.find((detail) => detail.product.id === selectedProductId) ?? null
    : null;

  return (
    <main className="leaderboard-shell">
      <div className="leaderboard-shell__backdrop" aria-hidden="true" />
      <div className="leaderboard-shell__content">
        <LeaderboardHero
          data={overviewQuery.data}
          isRefreshing={overviewQuery.isFetching && !overviewQuery.isPending}
          onRefresh={() => void overviewQuery.refetch()}
        />

        {overviewQuery.isPending ? (
          <section className="panel panel--loading">
            <div className="loading-grid">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="loading-card" />
              ))}
            </div>
          </section>
        ) : null}

        {overviewQuery.error ? (
          <section className="panel panel--error">
            <h2>榜单加载失败</h2>
            <p>{overviewQuery.error instanceof Error ? overviewQuery.error.message : "Competitive leaderboard failed to load."}</p>
            <button type="button" className="hero__refresh-button" onClick={() => void overviewQuery.refetch()}>
              重试
            </button>
          </section>
        ) : null}

        {overviewQuery.data ? (
          <>
            <UniverseMap productDetails={overviewQuery.data.productDetails} onInspect={setSelectedProductId} />
            <RankingBoard ranking={overviewQuery.data.ranking} onInspect={setSelectedProductId} />
            <SubRankingBoard
              subRankings={overviewQuery.data.spotlightBoards}
              productDetails={overviewQuery.data.productDetails}
              onInspect={setSelectedProductId}
            />
            <ProductProfileGrid productDetails={overviewQuery.data.productDetails} onInspect={setSelectedProductId} />
            <MethodologyPanel
              methodology={overviewQuery.data.methodology}
              disclosures={overviewQuery.data.disclosures}
              changeLog={overviewQuery.data.changeLog}
            />
            <EvidenceDrawer detail={activeDetail} onClose={() => setSelectedProductId(null)} />
          </>
        ) : null}
      </div>
    </main>
  );
}
