import { useState } from "react";
import { Link } from "react-router-dom";
import { AppCover } from "@/features/app-marketplace/components/app-cover.js";
import type { AppItemSummary } from "@/features/app-marketplace/types/app-marketplace.types.js";
import { formatAppPlatformLabel } from "@/features/app-marketplace/utils/app-platform-label.utils.js";

export function AppCard({ item }: { item: AppItemSummary }) {
  const [iconFailed, setIconFailed] = useState(false);
  const summary = localized(item.summaryI18n, item.summary);
  return (
    <article className="app-card">
      <Link className="app-card__cover-link" to={`/apps/${item.slug}`} aria-label={`查看 ${item.name}`}>
        <AppCover
          accentColor={item.accentColor}
          coverUrl={item.coverUrl}
          name={item.name}
        />
      </Link>
      <div className="app-card__topline">
        <Link className="app-artwork" to={`/apps/${item.slug}`} aria-label={`查看 ${item.name}`}>
          {item.iconUrl && !iconFailed ? (
            <img src={item.iconUrl} alt="" onError={() => setIconFailed(true)} />
          ) : (
            <span>{initials(item.name)}</span>
          )}
        </Link>
        <div className="app-card__header">
          <h2><Link to={`/apps/${item.slug}`}>{item.name}</Link></h2>
          <p className="app-card__publisher">
            <span className="verified-dot" aria-hidden="true">✓</span>
            {item.publisher.name}
          </p>
        </div>
        <span className="version-pill">v{item.latestVersion}</span>
      </div>
      <p className="app-card__summary">{summary}</p>
      <div className="app-card__footer">
        <span>{localizedTag(item.tags[0])} · {formatAppPlatformLabel(item.availability)}</span>
        <Link to={`/apps/${item.slug}`} aria-label={`查看 ${item.name} 详情`}>查看</Link>
      </div>
    </article>
  );
}

function localized(values: Record<string, string>, fallback: string): string {
  const language = document.documentElement.lang.toLowerCase();
  if (language.startsWith("zh")) {
    return values["zh-CN"] ?? values.zh ?? fallback;
  }
  return values["en-US"] ?? values.en ?? fallback;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function localizedTag(tag: string | undefined): string {
  const labels: Record<string, string> = {
    calendar: "日历",
    documents: "资料",
    local: "本机",
    notes: "笔记",
    personal: "个人",
    productivity: "效率",
    workspace: "工作空间",
  };
  return tag ? labels[tag] ?? tag : "Mini APP";
}
