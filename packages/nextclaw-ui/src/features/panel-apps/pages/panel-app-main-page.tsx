import { useEffect, useMemo, useRef } from "react";
import { Boxes, RotateCcw } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { usePanelAppMainRuntime } from "@/features/panel-apps/hooks/use-panel-app-main-runtime";
import {
  usePanelApps,
} from "@/features/panel-apps/hooks/use-panel-apps";
import {
  PANEL_APP_IFRAME_SANDBOX,
  focusPanelAppIframe,
} from "@/features/panel-apps/utils/panel-app-iframe.utils";
import { openApps } from "@/features/panel-apps/utils/panel-app-doc-browser.utils";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { t } from "@/shared/lib/i18n";

export function PanelAppMainPage() {
  const { appId = "" } = useParams<{ appId: string }>();
  const presenter = useAppPresenter();
  const docBrowser = useDocBrowser();
  const panelApps = usePanelApps();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const entry = useMemo(
    () => panelApps.data?.entries.find((candidate) => candidate.appId === appId),
    [appId, panelApps.data?.entries],
  );
  const runtime = usePanelAppMainRuntime(entry);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      presenter.panelAppBridgeManager.handleIframeMessage({
        event,
        iframe: iframeRef.current,
      });
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [presenter]);

  if (panelApps.isLoading) {
    return <PanelAppMainStatus message={t("panelAppsLoading")} />;
  }

  if (panelApps.isError) {
    return (
      <PanelAppMainStatus
        message={panelApps.error instanceof Error
          ? panelApps.error.message
          : t("panelAppsLoadFailed")}
        actionLabel={t("panelAppsTryAgain")}
        onAction={() => void panelApps.refetch()}
      />
    );
  }

  if (!entry) {
    return (
      <PanelAppMainStatus
        message={t("panelAppsMainUnavailable")}
        actionLabel={t("panelAppsOpenApps")}
        onAction={() => openApps(docBrowser)}
      />
    );
  }

  if (runtime.state === "checking" || runtime.state === "idle") {
    return <PanelAppMainStatus message={t("panelAppsCheckingPermission")} />;
  }

  if (runtime.state === "denied" || runtime.state === "error") {
    return (
      <PanelAppMainStatus
        message={runtime.state === "denied"
          ? t("panelAppsPermissionDenied")
          : t("panelAppsPermissionFailed")}
        actionLabel={t("panelAppsTryAgain")}
        onAction={() => void runtime.retryClientGrant()}
      />
    );
  }

  return (
    <div className="h-full min-h-0 bg-background">
      <iframe
        key={entry.appId}
        ref={iframeRef}
        src={entry.contentPath}
        title={entry.title}
        sandbox={PANEL_APP_IFRAME_SANDBOX}
        className="block h-full w-full border-0 bg-background"
        onPointerOver={(event) => focusPanelAppIframe(event.currentTarget)}
      />
    </div>
  );
}

function PanelAppMainStatus({
  actionLabel,
  message,
  onAction,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-background px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {onAction ? <RotateCcw className="h-5 w-5" /> : <Boxes className="h-5 w-5" />}
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            className="mt-4 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
