import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  AppDetailPage,
  AppsPage,
  HomePage,
  PublisherPage,
  useAppMarketplaceDetail,
  useAppsMarketplace,
  useHomeMarketplace,
  usePublisherMarketplace,
} from "@/features/app-marketplace/index.js";

function HomeRoute() {
  const resource = useHomeMarketplace();
  return (
    <HomePage
      featuredApps={resource.data ?? []}
      onRetry={resource.retry}
      status={resource.status}
    />
  );
}

function AppsRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [draftQuery, setDraftQuery] = useState(query);
  const tag = searchParams.get("tag") ?? "";
  const cursor = searchParams.get("cursor") ?? undefined;
  const resource = useAppsMarketplace(query, tag, cursor);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    const nextQuery = draftQuery.trim();
    if (nextQuery === query) {
      return;
    }
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (nextQuery) {
        next.set("q", nextQuery);
      } else {
        next.delete("q");
      }
      next.delete("cursor");
      setSearchParams(next, { replace: true });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [draftQuery, query, searchParams, setSearchParams]);

  return (
    <AppsPage
      data={resource.data}
      onRetry={resource.retry}
      query={draftQuery}
      tag={tag}
      error={resource.status === "error"}
      onNextPage={(nextCursor: string) => {
        const next = new URLSearchParams(searchParams);
        next.set("cursor", nextCursor);
        setSearchParams(next);
      }}
      onQueryChange={setDraftQuery}
      onTagChange={(value: string) => {
        const next = new URLSearchParams(searchParams);
        if (value) {
          next.set("tag", value);
        } else {
          next.delete("tag");
        }
        next.delete("cursor");
        setSearchParams(next);
      }}
    />
  );
}

function AppDetailRoute() {
  const params = useParams();
  const selector = params.slug ?? "";
  const resource = useAppMarketplaceDetail(selector);
  return (
    <AppDetailPage
      app={resource.data?.app ?? null}
      onRetry={resource.retry}
      readme={resource.data?.readme ?? null}
      status={resource.status}
    />
  );
}

function PublisherRoute() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const publisherId = params.publisherId ?? "";
  const cursor = searchParams.get("cursor") ?? undefined;
  const resource = usePublisherMarketplace(publisherId, cursor);
  return (
    <PublisherPage
      publisherId={publisherId}
      data={resource.data}
      onNextPage={(nextCursor) => {
        const next = new URLSearchParams(searchParams);
        next.set("cursor", nextCursor);
        setSearchParams(next);
      }}
      onRetry={resource.retry}
      status={resource.status}
    />
  );
}

function Shell() {
  const location = useLocation();

  return (
    <div className="shell">
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>NextClaw</span>
        </Link>
        <nav className="site-nav" aria-label="主导航">
          <Link className={location.pathname.startsWith("/apps") ? "nav-link nav-link--active" : "nav-link"} to="/apps">
            应用
          </Link>
          <a className="nav-link" href="https://github.com/Peiiii/nextclaw" target="_blank" rel="noreferrer">开发者</a>
        </nav>
      </header>
      <main className="site-main">
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/apps" element={<AppsRoute />} />
          <Route path="/apps/:slug" element={<AppDetailRoute />} />
          <Route path="/publishers/:publisherId" element={<PublisherRoute />} />
          <Route path="*" element={<Navigate to="/apps" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <span>NextClaw Apps</span>
        <span>把能力装进你的个人操作层。</span>
      </footer>
    </div>
  );
}

export function App() {
  return <Shell />;
}
