import type { AppItemSummary } from "../app.types.js";
import { AppCard } from "../components/app-card.js";

export function PublisherPage(props: {
  publisherId: string;
  items: AppItemSummary[];
}) {
  return (
    <div className="page-stack">
      <section className="section-panel">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Publisher</p>
            <h1>{props.publisherId}</h1>
          </div>
        </div>
        <div className="app-grid">
          {props.items.map((item) => (
            <AppCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
