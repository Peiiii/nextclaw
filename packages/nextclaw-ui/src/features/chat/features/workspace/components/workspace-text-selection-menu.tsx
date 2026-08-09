import type { ReactNode } from "react";
import { ChatTextSelectionAction } from "@nextclaw/agent-chat-ui";
import {
  buildWorkspaceTextExcerpt,
  WORKSPACE_TEXT_EXCERPT_MAX_CHARACTERS,
  type WorkspaceTextExcerpt,
} from "@/features/chat/features/workspace/utils/workspace-text-excerpt.utils";
import { t } from "@/shared/lib/i18n";

export function WorkspaceTextSelectionMenu({
  children,
  fileLabel,
  filePath,
  onAddToChat,
  sourceStartLine,
  sourceText,
}: {
  children: ReactNode;
  fileLabel: string;
  filePath: string;
  onAddToChat?: (excerpt: WorkspaceTextExcerpt) => void;
  sourceStartLine?: number | null;
  sourceText: string;
}) {
  return (
    <ChatTextSelectionAction
      actionLabel={t("chatWorkspaceAddToChat")}
      className="h-full min-h-0"
      maxCharacters={WORKSPACE_TEXT_EXCERPT_MAX_CHARACTERS}
      selectionTooLongLabel={t("chatWorkspaceExcerptSelectionTooLong")}
      onAddToChat={({ text }) => {
        const excerpt = buildWorkspaceTextExcerpt({
          path: filePath,
          label: fileLabel,
          selectedText: text,
          sourceText,
          sourceStartLine,
        });
        if (excerpt) onAddToChat?.(excerpt);
      }}
    >
      {children}
    </ChatTextSelectionAction>
  );
}
