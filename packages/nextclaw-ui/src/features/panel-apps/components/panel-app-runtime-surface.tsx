import { useEffect, useMemo, useRef } from "react";
import { Boxes, RotateCcw } from "lucide-react";
import { usePanelAppHostPresenter } from "@/features/panel-apps/providers/panel-app-host.provider";
import { usePanelAppRuntime } from "@/features/panel-apps/hooks/use-panel-app-runtime";
import { usePanelApp } from "@/features/panel-apps/hooks/use-panel-apps";
import {
  PANEL_APP_IFRAME_SANDBOX,
  focusPanelAppIframe,
} from "@/features/panel-apps/utils/panel-app-iframe.utils";
import { usePanelAppScrollRestoration } from "@/shared/hooks/use-panel-app-scroll-restoration";
import { t } from "@/shared/lib/i18n";

type PanelAppUnavailableAction = {
  label: string;
  onAction: () => void;
};

export function PanelAppRuntimeSurface({
  appId,
  restorationScope,
  unavailableAction,
}: {
  appId: string;
  restorationScope: "main" | "standalone";
  unavailableAction?: PanelAppUnavailableAction;
}) {
  const presenter = usePanelAppHostPresenter();
  const panelApp = usePanelApp(appId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const entry = useMemo(
    () => panelApp.data,
    [panelApp.data],
  );
  const runtime = usePanelAppRuntime(entry);
  const restoreScroll = usePanelAppScrollRestoration({
    currentUrl: entry?.contentPath ?? null,
    iframeRef,
    isEnabled: Boolean(entry),
    restorationKey: entry
      ? `panel-app:${restorationScope}:${entry.appId}`
      : null,
  });

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

  if (panelApp.isLoading) {
    return <PanelAppRuntimeStatus message={t("panelAppsLoading")} />;
  }

  if (panelApp.isError) {
    return (
      <PanelAppRuntimeStatus
        message={panelApp.error instanceof Error
          ? panelApp.error.message
          : t("panelAppsLoadFailed")}
        actionLabel={t("panelAppsTryAgain")}
        onAction={() => void panelApp.refetch()}
      />
    );
  }

  if (!entry) {
    return (
      <PanelAppRuntimeStatus
        message={t("panelAppsMainUnavailable")}
        actionLabel={unavailableAction?.label}
        onAction={unavailableAction?.onAction}
      />
    );
  }

  if (runtime.state === "checking" || runtime.state === "idle") {
    return <PanelAppRuntimeStatus message={t("panelAppsCheckingPermission")} />;
  }

  if (runtime.state === "denied" || runtime.state === "error") {
    return (
      <PanelAppRuntimeStatus
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
        onLoad={restoreScroll}
        onPointerOver={(event) => focusPanelAppIframe(event.currentTarget)}
      />
    </div>
  );
}

function PanelAppRuntimeStatus({
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
