import { useEffect, useMemo } from "react";
import { PanelAppRuntimeSurface } from "@/features/panel-apps/components/panel-app-runtime-surface";
import { usePanelApp } from "@/features/panel-apps/hooks/use-panel-apps";
import { t } from "@/shared/lib/i18n";

export function PanelAppStandalonePage({ appId }: { appId: string }) {
  const panelApp = usePanelApp(appId);
  const entry = useMemo(
    () => panelApp.data,
    [panelApp.data],
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${entry?.title ?? t("panelAppsTitle")} · NextClaw`;
    return () => {
      document.title = previousTitle;
    };
  }, [entry?.title]);

  return (
    <main className="h-dvh min-h-0 w-full overflow-hidden bg-background">
      <PanelAppRuntimeSurface
        appId={appId}
        restorationScope="standalone"
      />
    </main>
  );
}
