import { Link } from "react-router-dom";
import type { AppItemSummary } from "../app.types.js";

export function AppCard({ item }: { item: AppItemSummary }) {
  return (
    <article className="app-card">
      <div className="app-card__header">
        <p className="app-card__eyebrow">{item.publisher.name}</p>
        <h3>
          <Link to={`/apps/${item.slug}`}>{item.name}</Link>
        </h3>
      </div>
      <p className="app-card__summary">{item.summary}</p>
      <div className="app-card__meta">
        <span>{item.appId}</span>
        <span>v{item.latestVersion}</span>
      </div>
      <div className="app-card__tags">
        {item.tags.map((tag: string) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <code className="install-command">{item.install.command}</code>
    </article>
  );
}
