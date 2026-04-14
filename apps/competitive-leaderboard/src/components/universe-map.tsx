import type { ProductDetail } from "@shared/competitive-leaderboard.types";
import { formatComparability, formatScore } from "../lib/leaderboard-format.utils";
import { Panel } from "./panel";

type UniverseMapProps = {
  productDetails: ProductDetail[];
  onInspect: (productId: string) => void;
};

const GROUP_ORDER = ["core", "adjacent", "watch"] as const;

export function UniverseMap({ productDetails, onInspect }: UniverseMapProps): JSX.Element {
  const groupedDetails = GROUP_ORDER.map((groupId) => ({
    id: groupId,
    label: formatComparability(groupId),
    items: productDetails.filter((detail) => detail.product.comparability === groupId)
  })).filter((group) => group.items.length > 0);

  return (
    <Panel
      eyebrow="Universe Map"
      title="先画全市场，再谈总榜"
      subtitle="真正可信的榜单，第一步不是排分，而是先把谁是真正龙虾类、谁只是直接衍生物，以及哪些知名产品虽然被审查过但不该混排说清楚。"
    >
      <div className="universe-grid">
        {groupedDetails.map((group) => (
          <section key={group.id} className="universe-column">
            <header className="universe-column__header">
              <h3>{group.label}</h3>
              <span>{group.items.length} 个产品</span>
            </header>
            <div className="universe-column__cards">
              {group.items.map((detail) => (
                <button
                  key={detail.product.id}
                  type="button"
                  className="universe-card"
                  onClick={() => onInspect(detail.product.id)}
                >
                  <div className="universe-card__topline">
                    <span className="universe-card__name">{detail.product.displayName}</span>
                    <span className="universe-card__category">{detail.product.category}</span>
                  </div>
                  <p className="universe-card__summary">{detail.product.shortDescription}</p>
                  <div className="universe-card__meta">
                    <span>公共信号 {detail.scoreBreakdown.publicSignalScore.toFixed(1)} / 40</span>
                    <span>{formatScore(detail.overallScore)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}
