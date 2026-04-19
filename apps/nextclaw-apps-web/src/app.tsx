import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { appsMarketplaceClient } from "./apps-marketplace.service.js";
import type { AppItemDetail, AppItemSummary, AppListResult } from "./app.types.js";
import { AppsPage } from "./pages/apps-page.js";
import { AppDetailPage } from "./pages/app-detail-page.js";
import { HomePage } from "./pages/home-page.js";
import { PublisherPage } from "./pages/publisher-page.js";

function HomeRoute() {
  const [featuredApps, setFeaturedApps] = useState<AppItemSummary[]>([]);

  useEffect(() => {
    void appsMarketplaceClient.listApps({ pageSize: 12 }).then((result: AppListResult) => {
      setFeaturedApps(result.items.filter((item: AppItemSummary) => item.featured).slice(0, 6));
    });
  }, []);

  return <HomePage featuredApps={featuredApps} />;
}

function AppsRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const [data, setData] = useState<AppListResult | null>(null);

  useEffect(() => {
    void appsMarketplaceClient
      .listApps({ q: query || undefined, tag: tag || undefined })
      .then((result: AppListResult) => {
        setData(result);
      });
  }, [query, tag]);

  return (
    <AppsPage
      data={data}
      query={query}
      tag={tag}
      onQueryChange={(value: string) => {
        const next = new URLSearchParams(searchParams);
        if (value) {
          next.set("q", value);
        } else {
          next.delete("q");
        }
        setSearchParams(next);
      }}
      onTagChange={(value: string) => {
        const next = new URLSearchParams(searchParams);
        if (value) {
          next.set("tag", value);
        } else {
          next.delete("tag");
        }
        setSearchParams(next);
      }}
    />
  );
}

function AppDetailRoute() {
  const params = useParams();
  const selector = params.slug ?? "";
  const [app, setApp] = useState<AppItemDetail | null>(null);
  const [readme, setReadme] = useState<string | null>(null);

  useEffect(() => {
    if (!selector) {
      return;
    }
    void Promise.all([
      appsMarketplaceClient.getApp(selector),
      appsMarketplaceClient.getReadme(selector),
    ]).then(([nextApp, nextReadme]: [AppItemDetail, string | null]) => {
      setApp(nextApp);
      setReadme(nextReadme);
    });
  }, [selector]);

  return <AppDetailPage app={app} readme={readme} />;
}

function PublisherRoute() {
  const params = useParams();
  const publisherId = params.publisherId ?? "";
  const [items, setItems] = useState<AppItemSummary[]>([]);

  useEffect(() => {
    void appsMarketplaceClient.listApps({ pageSize: 100 }).then((result: AppListResult) => {
      setItems(result.items.filter((item: AppItemSummary) => item.publisher.id === publisherId));
    });
  }, [publisherId]);

  return <PublisherPage publisherId={publisherId} items={items} />;
}

function Shell() {
  const location = useLocation();

  return (
    <div className="shell">
      <header className="site-header">
        <Link className="brand" to="/">
          NextClaw Apps
        </Link>
        <nav>
          <Link className={location.pathname.startsWith("/apps") ? "nav-link nav-link--active" : "nav-link"} to="/apps">
            Apps
          </Link>
        </nav>
      </header>
      <main className="site-main">
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/apps" element={<AppsRoute />} />
          <Route path="/apps/:slug" element={<AppDetailRoute />} />
          <Route path="/publishers/:publisherId" element={<PublisherRoute />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return <Shell />;
}
