import { useParams } from "react-router-dom";
import { PanelAppRuntimeSurface } from "@/features/panel-apps/components/panel-app-runtime-surface";
import { openApps } from "@/features/panel-apps/utils/panel-app-doc-browser.utils";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { t } from "@/shared/lib/i18n";

export function PanelAppMainPage() {
  const { appId = "" } = useParams<{ appId: string }>();
  const docBrowser = useDocBrowser();

  return (
    <PanelAppRuntimeSurface
      appId={appId}
      restorationScope="main"
      unavailableAction={{
        label: t("panelAppsOpenApps"),
        onAction: () => openApps(docBrowser),
      }}
    />
  );
}
