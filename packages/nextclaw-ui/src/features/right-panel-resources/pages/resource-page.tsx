import {
  isDocsUrl,
  normalizeDocUrl,
} from "@/shared/components/doc-browser/utils/doc-browser-url.utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { PAGE_RESOURCE_RENDERERS } from "@/app/configs/page-resource-renderers.config";
import { DocBrowserFrameContent } from "@/shared/components/doc-browser/doc-browser-panel-parts";
import { useDocBrowserScrollRestoration } from "@/shared/components/doc-browser/hooks/use-doc-browser-scroll-restoration";
import { PageResourceActionsMenu } from "@/features/right-panel-resources/components/page-resource-actions-menu";
import { PageResourceIcon } from "@/features/right-panel-resources/components/page-resource-icon";
import { pageResourceTab } from "@/features/right-panel-resources/managers/page-resource.manager";
import { pageResourceFromTarget } from "@/features/right-panel-resources/utils/page-resource-identity.utils";
import type { PageResource } from "@/features/right-panel-resources/types/page-resource.types";
import { t } from "@/shared/lib/i18n";

function ResourcePageContent({ page }: { page: PageResource }) {
  const app = useAppPresenter();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [revision, setRevision] = useState(0);
  const tab = useMemo(() => pageResourceTab(page), [page]);
  const renderer = PAGE_RESOURCE_RENDERERS[tab.kind];
  const iframeInstanceId = `main:${page.uri}:${revision}`;
  const restore = useDocBrowserScrollRestoration({
    currentTab: tab,
    iframeRef,
    isEnabled: Boolean(renderer?.supportsScrollRestoration),
  });
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (
        tab.kind === "docs" &&
        event.data?.type === "docs-route-change" &&
        typeof event.data.url === "string" &&
        isDocsUrl(event.data.url) &&
        normalizeDocUrl(event.data.url) !== normalizeDocUrl(tab.currentUrl)
      ) {
        const next = app.pageResourceManager.resolve(event.data.url);
        if (next) app.pageResourceManager.open(next, "main", navigate);
      }
      renderer?.onIframeMessage?.({
        event,
        iframe: iframeRef.current,
        iframeInstanceId,
        tab,
      });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [app, navigate, iframeInstanceId, renderer, tab]);
  const params = {
    tab,
    currentUrl: tab.currentUrl,
    refreshIframe: () => setRevision((value) => value + 1),
    open: (uri?: string) => {
      const next = uri ? app.pageResourceManager.resolve(uri) : null;
      if (next) app.pageResourceManager.open(next, "main", navigate);
    },
    openTarget: (target: PageResource["target"]) =>
      app.pageResourceManager.open(
        pageResourceFromTarget(target),
        "main",
        navigate,
      ),
  };
  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="resource-main-page"
    >
      <header className="flex min-h-10 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <PageResourceIcon uri={page.uri} icon={page.target.dockIcon} />
        <span className="min-w-0 flex-1 truncate text-sm">{page.title}</span>
        <PageResourceActionsMenu page={page} />
      </header>
      {renderer?.renderToolbar?.(params)}
      <DocBrowserFrameContent
        currentTab={tab}
        currentUrl={tab.currentUrl}
        customContent={renderer?.renderContent?.(params)}
        iframeRef={iframeRef}
        iframeInstanceId={iframeInstanceId}
        iframeSandbox={renderer?.getIframeSandbox?.(tab)}
        isDragging={false}
        isResizing={false}
        onIframeLoad={restore}
        onIframePointerOver={renderer?.onIframePointerOver}
      />
    </div>
  );
}

export function ResourcePage() {
  const app = useAppPresenter();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const uri = search.get("uri") ?? "";
  const page = useMemo(() => app.pageResourceManager.resolve(uri), [app, uri]);
  useEffect(() => {
    if (page?.target.kind === "workspace")
      app.pageResourceManager.open(page, "main", navigate);
  }, [app, navigate, page]);
  if (page?.target.kind === "workspace") return null;
  if (!page)
    return (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        {t("pageUnavailable")}
      </p>
    );
  return <ResourcePageContent key={page.uri} page={page} />;
}
