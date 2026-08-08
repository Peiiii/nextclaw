import { useCallback } from "react";
import type { ChatInlineTokenViewModel } from "@nextclaw/agent-chat-ui";
import {
  CHAT_PROJECT_TOKEN_KIND,
  CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
} from "@nextclaw/shared";
import { toast } from "sonner";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { resolveWorkspaceReferencePath } from "@/features/chat/features/input/utils/chat-inline-token.utils";
import { fetchNcpSessionSkills } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";

type SelectedSessionPaths = {
  projectRoot?: string | null;
  workingDir?: string | null;
} | null | undefined;

export function useChatInlineTokenActions(params: {
  selectedSession: SelectedSessionPaths;
  sessionKey: string | null;
}) {
  const { selectedSession, sessionKey } = params;
  const presenter = usePresenter();
  const projectRoot = selectedSession?.projectRoot ?? selectedSession?.workingDir;

  const handleInlineTokenClick = useCallback((token: ChatInlineTokenViewModel) => {
    if (token.kind === "panel_app" && "key" in token) {
      void presenter.chatUiManager.showContent({
        target: { type: "panel_app", payload: { appId: token.key } },
      });
      return;
    }
    if (
      "key" in token &&
      (token.kind === CHAT_PROJECT_TOKEN_KIND ||
        token.kind === "workspace_file" ||
        token.kind === "workspace_directory")
    ) {
      const path = token.kind === CHAT_PROJECT_TOKEN_KIND
        ? token.key
        : resolveWorkspaceReferencePath({ projectRoot, relativePath: token.key });
      if (path) {
        presenter.chatThreadManager.openFilePreview({
          path,
          label: token.label,
          viewMode: "preview",
        });
      }
      return;
    }
    if (token.kind === CHAT_WORKSPACE_EXCERPT_TOKEN_KIND && "excerpt" in token) {
      const path = resolveWorkspaceReferencePath({
        projectRoot,
        relativePath: token.path,
      });
      if (path) {
        presenter.chatThreadManager.openFilePreview({
          path,
          label: token.label,
          line: token.startLine ?? undefined,
          viewMode: "preview",
        });
      }
      return;
    }
    if (token.kind !== "skill" || !("ref" in token)) {
      return;
    }
    const skillPath = token.path?.trim();
    if (skillPath) {
      presenter.chatThreadManager.openFilePreview({
        path: skillPath,
        label: token.label || token.name,
        viewMode: "preview",
        previewViewer: "rendered",
      });
      return;
    }
    if (!sessionKey) {
      toast.error(t("chatSkillPreviewUnavailable"));
      return;
    }
    void fetchNcpSessionSkills(sessionKey, {
      projectRoot: selectedSession?.projectRoot ?? null,
    }).then(({ records }) => {
      const exact = records.find((record) => record.ref === token.ref);
      const named = records.filter((record) => record.name === token.name);
      const matched = exact ?? (named.length === 1 ? named[0] : null);
      const legacyPath = matched?.path.trim();
      if (!matched || !legacyPath) {
        toast.error(t("chatSkillPreviewUnavailable"));
        return;
      }
      presenter.chatThreadManager.openFilePreview({
        path: legacyPath,
        label: token.label || matched.name,
        viewMode: "preview",
        previewViewer: "rendered",
      });
    }).catch(() => toast.error(t("chatSkillPreviewUnavailable")));
  }, [presenter, projectRoot, selectedSession?.projectRoot, sessionKey]);

  const handleAttachmentOpen = useCallback((file: {
    label: string;
    mimeType: string;
    dataUrl?: string;
    sizeBytes?: number;
    isImage: boolean;
  }) => {
    const contentUrl = file.dataUrl?.trim();
    if (!contentUrl) {
      return;
    }
    const label = file.label.trim() || "attachment";
    presenter.chatThreadManager.openFilePreview({
      path: label,
      label,
      viewMode: "preview",
      contentUrl,
      mimeType: file.mimeType,
    });
  }, [presenter]);

  return { handleAttachmentOpen, handleInlineTokenClick };
}
