import type { ChangeEvent } from "react";
import type { AppItemSummary, AppListResult } from "../app.types.js";
import { AppCard } from "../components/app-card.js";

export function AppsPage(props: {
  data: AppListResult | null;
  query: string;
  tag: string;
  onQueryChange: (value: string) => void;
  onTagChange: (value: string) => void;
}) {
  return (
    <div className="page-stack">
      <section className="section-panel">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Catalog</p>
            <h1>NextClaw Apps</h1>
          </div>
          <p>{props.data ? `${props.data.total} apps` : "Loading..."}</p>
        </div>
        <div className="filters">
          <label>
            Search
            <input
              value={props.query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => props.onQueryChange(event.target.value)}
              placeholder="hello-notes"
            />
          </label>
          <label>
            Tag
            <input
              value={props.tag}
              onChange={(event: ChangeEvent<HTMLInputElement>) => props.onTagChange(event.target.value)}
              placeholder="official"
            />
          </label>
        </div>
        <div className="app-grid">
          {props.data?.items.map((item: AppItemSummary) => (
            <AppCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
