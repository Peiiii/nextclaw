import { lazy, Suspense, useState } from "react";
import type { DocBrowserCustomTabRenderParams } from "@/shared/components/doc-browser/doc-browser-renderer.types";
import { t } from "@/shared/lib/i18n";
import {
  createPanelAppRightPanelResourceTarget,
  type RightPanelAppsTab,
} from "@/features/right-panel-resources/utils/right-panel-resource-uri.utils";

const AgentsPage = lazy(async () => ({
  default: (await import("@/features/agents"))
    .AgentsPage,
}));
const CronJobResource = lazy(async () => ({
  default: (await import("@/features/cron"))
    .CronJobResource,
}));
const ProjectsPage = lazy(async () => ({
  default: (await import("@/features/projects"))
    .ProjectsPage,
}));
const InboxPage = lazy(async () => ({
  default: (await import("@/features/inbox")).InboxPage,
}));
const AppsPanel = lazy(async () => ({
  default: (await import("@/features/apps")).AppsPanel,
}));
const McpMarketplacePage = lazy(async () => ({
  default: (
    await import("@/features/marketplace")
  ).McpMarketplacePage,
}));
const PanelAppRuntimeSurface = lazy(async () => ({
  default: (
    await import("@/features/panel-apps")
  ).PanelAppRuntimeSurface,
}));
const PanelAppHostProvider = lazy(async () => ({
  default: (
    await import("@/features/panel-apps")
  ).PanelAppHostProvider,
}));

function ServiceAppResource({
  objectId,
  openTarget,
}: {
  objectId: string;
  openTarget: DocBrowserCustomTabRenderParams["openTarget"];
}) {
  const [activeTab, setActiveTab] = useState<RightPanelAppsTab>("service-apps");
  return (
    <AppsPanel
      serviceResourceId={objectId}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onOpenPanelApp={(entry) =>
        openTarget(createPanelAppRightPanelResourceTarget(entry))
      }
    />
  );
}

/** Object identity chooses domain content; the workbench owns placement. */
export function NativeObjectResource({
  objectType,
  objectId,
  openTarget,
}: {
  objectType: string;
  objectId: string;
  openTarget: DocBrowserCustomTabRenderParams["openTarget"];
}) {
  let content;
  switch (objectType) {
    case "agent":
      content = <AgentsPage resourceId={objectId} />;
      break;
    case "cron-job":
      content = <CronJobResource jobId={objectId} />;
      break;
    case "project":
      content = <ProjectsPage resourceId={objectId} />;
      break;
    case "project-work": {
      let ids: unknown;
      try {
        ids = JSON.parse(objectId);
      } catch {
        ids = null;
      }
      if (
        !Array.isArray(ids) ||
        ids.length !== 2 ||
        ids.some((id) => typeof id !== "string" || !id)
      )
        break;
      content = <ProjectsPage resourceId={ids[0]} resourceWorkId={ids[1]} />;
      break;
    }
    case "inbox-delivery":
      content = <InboxPage resourceId={objectId} />;
      break;
    case "mcp-server":
      content = <McpMarketplacePage resourceId={objectId} />;
      break;
    case "service-app":
      content = (
        <ServiceAppResource objectId={objectId} openTarget={openTarget} />
      );
      break;
    case "panel-app":
      content = (
        <PanelAppHostProvider>
          <PanelAppRuntimeSurface appId={objectId} restorationScope="main" />
        </PanelAppHostProvider>
      );
      break;
  }
  return (
    <Suspense
      fallback={
        <p role="status" className="p-4">
          {t("loading")}
        </p>
      }
    >
      {content ?? (
        <p role="alert" className="p-4">
          {t("resourceInvalid")}
        </p>
      )}
    </Suspense>
  );
}
