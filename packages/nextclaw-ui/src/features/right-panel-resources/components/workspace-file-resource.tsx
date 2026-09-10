import { FileText } from "lucide-react";
import type {
  DocBrowserCustomTabRenderers,
  DocBrowserCustomTabRenderParams,
} from "@/shared/components/doc-browser/doc-browser-renderer.types";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat";
import {
  createWorkspaceFilePanelTarget,
  readWorkspaceFilePanelView,
  WORKSPACE_FILE_PANEL_KIND,
} from "@/features/chat";
import { createWorkspaceFileTab } from "@/features/chat";
import { t } from "@/shared/lib/i18n";

function WorkspaceFilePanelContent({
  tab,
  openTarget,
}: DocBrowserCustomTabRenderParams) {
  const view = readWorkspaceFilePanelView(tab);
  if (!view)
    return (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        {t("workbenchFileUnavailable")}
      </p>
    );
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="workspace-file-panel-tab"
    >
      <ChatSessionWorkspaceFilePreview
        file={view.file}
        sessionWorkingDir={view.workingDir}
        sessionProjectRoot={view.projectRoot}
        onFileOpen={(action) => {
          const file = createWorkspaceFileTab(
            action,
            view.file.parentSessionKey,
          );
          if (file)
            openTarget(createWorkspaceFilePanelTarget(file, view), {
              newTab: true,
            });
        }}
      />
    </div>
  );
}

export const WORKSPACE_FILE_PANEL_RENDERERS: DocBrowserCustomTabRenderers = {
  [WORKSPACE_FILE_PANEL_KIND]: {
    getTitle: (tab) => tab.title,
    renderIcon: () => <FileText className="h-4 w-4" />,
    renderContent: (params) => <WorkspaceFilePanelContent {...params} />,
  },
};
