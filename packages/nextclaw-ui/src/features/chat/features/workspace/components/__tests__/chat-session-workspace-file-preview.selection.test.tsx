import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";

const onTextExcerptAdd = vi.fn();

vi.mock("@/shared/hooks/use-server-path-read", () => ({
  useServerPathRead: () => ({
    isLoading: false,
    error: null,
    data: {
      kind: "markdown",
      resolvedPath: "/Users/demo/.nextclaw/workspace/BOOT.md",
      startLine: 1,
      text: "Add short, explicit startup instructions.",
      truncated: false,
    },
  }),
}));

vi.mock("@/shared/hooks/use-server-path-browse", () => ({
  useServerPathBrowse: () => ({ isLoading: false, error: new Error("not a directory"), data: null }),
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  ChatMessageMarkdown: ({ text }: { text: string }) => <div>{text}</div>,
  FileOperationCodeSurface: () => null,
  ChatTextSelectionAction: ({ children, onAddToChat }: { children: ReactNode; onAddToChat: (value: { text: string }) => void }) => (
    <div>
      {children}
      <button type="button" onClick={() => onAddToChat({ text: "Add short, explicit startup instructions." })}>
        select excerpt
      </button>
    </div>
  ),
}));

describe("ChatSessionWorkspaceFilePreview selection", () => {
  it("uses the resolved absolute path when a shell-style workspace root cannot be compared in the browser", () => {
    render(
      <ChatSessionWorkspaceFilePreview
        file={{
          key: "boot",
          parentSessionKey: null,
          path: "/Users/demo/.nextclaw/workspace/BOOT.md",
          label: "BOOT.md",
          viewMode: "preview",
        }}
        sessionProjectRoot="~/.nextclaw/workspace"
        sessionWorkingDir="~/.nextclaw/workspace"
        onFileOpen={vi.fn()}
        onTextExcerptAdd={onTextExcerptAdd}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "select excerpt" }));
    expect(onTextExcerptAdd).toHaveBeenCalledWith({
      path: "/Users/demo/.nextclaw/workspace/BOOT.md",
      label: "BOOT.md",
      excerpt: "Add short, explicit startup instructions.",
      startLine: 1,
      endLine: 1,
    });
  });
});
