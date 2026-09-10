import { resolveAlternateWorkspaceFileViewer } from "@/features/chat";
import { readWorkspaceFilePanelView } from "@/features/chat";
import { useLocation, useNavigate } from "react-router-dom";
import {
  usePanelApps,
  useUpdatePanelAppPreferences,
} from "@/features/panel-apps";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import { usePageNavigationStore } from "@/features/right-panel-resources/stores/page-navigation.store";
import {
  readPanelAppIdFromTab,
  createChatUiResourceReferenceFromTab,
} from "@/features/right-panel-resources/utils/right-panel-resource-uri.utils";
import { pageResourceTab } from "@/features/right-panel-resources/managers/page-resource.manager";
import type { PageResource } from "@/features/right-panel-resources/types/page-resource.types";
import type { ContextMenuGroup } from "@/shared/components/ui/context-menu/context-menu";
import { t } from "@/shared/lib/i18n";
import { toast } from "sonner";

export function usePageResourceActions() {
  const app = useAppPresenter();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const pins = usePageNavigationStore((state) => state.pinned);
  const apps = usePanelApps();
  const updatePreferences = useUpdatePanelAppPreferences();
  return (
    page: PageResource,
    origin?: "main" | "global" | "workspace",
  ): ContextMenuGroup[] => {
    const tab = pageResourceTab(page);
    const file = readWorkspaceFilePanelView(tab)?.file;
    const viewer =
      file?.viewMode === "preview"
        ? resolveAlternateWorkspaceFileViewer(file.path, file.previewViewer)
        : null;
    const appId = readPanelAppIdFromTab(tab);
    const entry = apps.data?.entries.find(
      (candidate) => candidate.appId === appId,
    );
    const pinned = entry
      ? entry.mainSidebar
      : pins.some((item) => item.uri === page.uri);
    const open = (location: "main" | "sidebar" | "floating") =>
      app.pageResourceManager.open(page, location, navigate);
    const items = [
      {
        key: "open-main",
        label: t(page.target.kind === "workspace" ? "workbenchMaximize" : "workbenchOpenMain"),
        onSelect: () => open("main"),
      },
      ...(page.target.kind === "route"
        ? []
        : [
            {
              key: "open-sidebar",
              label: t("workbenchDock"),
              onSelect: () => open("sidebar"),
            },
            {
              key: "open-floating",
              label: t("workbenchFloatView"),
              onSelect: () => open("floating"),
            },
          ]),
      {
        key: "pin-left",
        pressed: pinned,
        label: t(pinned ? "pageUnpinLeft" : "pagePinLeft"),
        disabled: Boolean(entry && updatePreferences.isPending),
        onSelect: () => {
          if (entry)
            updatePreferences.mutate({
              id: entry.id,
              preferences: { mainSidebar: !pinned },
            });
          else if (pinned) app.pageResourceManager.unpin(page.uri);
          else app.pageResourceManager.pin(page);
          if (!pinned)
            viewportLayoutManager.setMainSidebarAppGroupCollapsed(false);
        },
      },
      ...(createChatUiResourceReferenceFromTab(tab)
        ? [
            {
              key: "add-to-chat",
              label: t("docBrowserAddToChat"),
              restoreFocus: false,
              onSelect: () =>
                app.pageResourceManager.addToChat(page, pathname, navigate),
            },
          ]
        : []),
      {
        key: "copy-uri",
        label: t("pageCopyUri"),
        onSelect: () => {
          void navigator.clipboard
            .writeText(page.uri)
            .catch(() => toast.error(t("pageCopyFailed")));
        },
      },
    ];
    return [
      { key: "page", items },
      ...(viewer
        ? [
            {
              key: "file-view",
              items: [
                {
                  key: `viewer:${viewer}`,
                  label: t(
                    viewer === "rendered"
                      ? "chatWorkspaceOpenPreview"
                      : "chatWorkspaceOpenSource",
                  ),
                  onSelect: () =>
                    app.pageResourceManager.openFileViewer(
                      page,
                      viewer,
                      origin ??
                        (pathname === "/resource" &&
                        new URLSearchParams(search).get("uri") === page.uri
                          ? "main"
                          : undefined),
                      navigate,
                    ),
                },
              ],
            },
          ]
        : []),
    ];
  };
}
