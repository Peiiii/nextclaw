import { NextClawClientError } from "@nextclaw/client-sdk";
import { useQuery } from "@tanstack/react-query";
import { nextclawClient, buildNcpAssetContentUrl } from "@/shared/lib/api";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat";
import { createWorkspaceFileTab } from "@/features/chat";
import { createWorkspaceFilePanelTarget } from "@/features/chat";
import type {
  DocBrowserCustomTabRenderParams,
  DocBrowserCustomTabRenderers,
} from "@/shared/components/doc-browser/doc-browser-renderer.types";
import { t } from "@/shared/lib/i18n";

function SystemObjectResource({
  tab,
  openTarget,
}: DocBrowserCustomTabRenderParams) {
  const uri = tab.resourceUri ?? tab.currentUrl;
  const query = useQuery({
    queryKey: ["resource-object-snapshot", uri],
    queryFn: async ({ signal }) => {
      const reference =
        await nextclawClient.systemObjectReferences.resolve(uri);
      const response = await fetch(
        buildNcpAssetContentUrl(reference.assetUri),
        { signal },
      );
      if (!response.ok)
        throw new Error(`Unable to read resource (${response.status})`);
      return { reference, content: await response.text() };
    },
    retry: false,
  });
  if (query.isPending)
    return (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        {t("loading")}
      </p>
    );
  if (!query.data) {
    const code =
      query.error instanceof NextClawClientError ? query.error.code : undefined;
    const message =
      code === "SYSTEM_OBJECT_NOT_FOUND"
        ? "resourceNotFound"
        : code === "SYSTEM_OBJECT_INVALID_REFERENCE"
          ? "resourceInvalid"
          : "resourceLoadFailed";
    return (
      <div className="space-y-2 p-4">
        <p role="alert" className="text-sm text-destructive">
          {t(message)}
        </p>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => void query.refetch()}
        >
          {t("resourceRetry")}
        </button>
      </div>
    );
  }
  const { reference, content } = query.data;
  const file = createWorkspaceFileTab(
    {
      path: reference.fileName,
      label: reference.label,
      viewMode: "preview",
      previewViewer: "rendered",
      rawText: content,
      mimeType: reference.mimeType,
    },
    null,
  )!;
  return (
    <ChatSessionWorkspaceFilePreview
      file={{ ...file, key: uri }}
      sessionWorkingDir={null}
      sessionProjectRoot={null}
      onFileOpen={(action) => {
        const next = createWorkspaceFileTab(action, null);
        if (next)
          openTarget(
            createWorkspaceFilePanelTarget(next, {
              workingDir: null,
              projectRoot: null,
            }),
            { newTab: true },
          );
      }}
    />
  );
}

export const SYSTEM_OBJECT_RESOURCE_RENDERERS: DocBrowserCustomTabRenderers = {
  "system-object": {
    getTitle: (tab) => tab.title,
    renderContent: (params) => <SystemObjectResource {...params} />,
  },
};
