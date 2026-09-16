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
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { useLocation, useNavigate } from "react-router-dom";
import { parseSystemObjectReferenceUri } from "@nextclaw/shared";
import { NativeObjectResource } from "./native-object-resource";
import { ChatTextSelectionAction } from "@nextclaw/agent-chat-ui";
import { WORKSPACE_TEXT_EXCERPT_MAX_CHARACTERS } from "@/features/chat";

function SystemObjectResource({
  tab,
  openTarget,
}: DocBrowserCustomTabRenderParams) {
  const app = useAppPresenter();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const uri = tab.resourceUri ?? tab.currentUrl;
  const identity = parseSystemObjectReferenceUri(uri);
  if (!identity)
    return (
      <p role="alert" className="p-4">
        {t("resourceInvalid")}
      </p>
    );
  if (identity.objectType !== "skill") {
    return (
      <ChatTextSelectionAction
        actionLabel={t("chatWorkspaceAddToChat")}
        className="h-full min-h-0"
        maxCharacters={WORKSPACE_TEXT_EXCERPT_MAX_CHARACTERS}
        selectionTooLongLabel={t("chatWorkspaceExcerptSelectionTooLong")}
        onAddToChat={({ text }) =>
          app.pageResourceManager.addExcerptToChat(
            {
              path: uri,
              label: tab.title,
              excerpt: text,
              startLine: null,
              endLine: null,
            },
            pathname,
            navigate,
          )
        }
      >
        <NativeObjectResource key={uri} {...identity} openTarget={openTarget} />
      </ChatTextSelectionAction>
    );
  }
  return <SystemObjectDocument tab={tab} openTarget={openTarget} />;
}

function SystemObjectDocument({
  tab,
  openTarget,
}: Pick<DocBrowserCustomTabRenderParams, "tab" | "openTarget">) {
  const app = useAppPresenter();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const uri = tab.resourceUri ?? tab.currentUrl;
  const query = useQuery({
    queryKey: ["resource-object-snapshot", uri],
    queryFn: async ({ signal }) => {
      const reference =
        await nextclawClient.systemObjectReferences.resolve(uri);
      const response = await fetch(
        buildNcpAssetContentUrl(reference.assetUri),
        { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) },
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
      onTextExcerptAdd={(excerpt) =>
        app.pageResourceManager.addExcerptToChat(
          {
            ...excerpt,
            path: uri,
            label: reference.label,
            startLine: null,
            endLine: null,
          },
          pathname,
          navigate,
        )
      }
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
