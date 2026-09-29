import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, RefreshCw, RotateCcw } from "lucide-react";
import { usePanelAppHostPresenter } from "@/features/panel-apps/providers/panel-app-host.provider";
import { usePanelAppRuntime } from "@/features/panel-apps/hooks/use-panel-app-runtime";
import { usePanelApp } from "@/features/panel-apps/hooks/use-panel-apps";
import {
  PANEL_APP_IFRAME_SANDBOX,
  focusPanelAppIframe,
} from "@/features/panel-apps/utils/panel-app-iframe.utils";
import { usePanelAppScrollRestoration } from "@/shared/hooks/use-panel-app-scroll-restoration";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
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
  const [refreshVersion, setRefreshVersion] = useState(0);
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
    <div className="relative h-full min-h-0 bg-background">
      <iframe
        key={`${entry.appId}:${refreshVersion}`}
        ref={iframeRef}
        src={entry.contentPath}
        title={entry.title}
        sandbox={PANEL_APP_IFRAME_SANDBOX}
        className="block h-full w-full border-0 bg-background"
        onLoad={restoreScroll}
        onPointerOver={(event) => focusPanelAppIframe(event.currentTarget)}
      />
      <IconActionButton
        icon={<RefreshCw className="h-3.5 w-3.5" />}
        label={t("panelAppsRefreshCurrent")}
        onClick={() => setRefreshVersion((version) => version + 1)}
        size="sm"
        className="absolute right-3 top-3 z-10 border border-border/70 bg-card shadow-sm"
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
