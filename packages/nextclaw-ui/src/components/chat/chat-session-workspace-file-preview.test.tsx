import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSessionWorkspaceFilePreview } from "@/components/chat/chat-session-workspace-file-preview";
import type { ChatWorkspaceFileTab } from "@/components/chat/stores/chat-thread.store";

const serverPathReadMock = vi.fn();

vi.mock("@/hooks/server-path/use-server-path-read", () => ({
  useServerPathRead: (...args: unknown[]) => serverPathReadMock(...args),
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  ChatMessageMarkdown: ({ text }: { text: string }) => (
    <div data-testid="markdown-preview">{text}</div>
  ),
  FileOperationCodeSurface: ({
    layout,
  }: {
    layout?: "compact" | "workspace";
  }) => <div data-testid="file-code-surface" data-layout={layout ?? "compact"} />,
}));

function buildWorkspaceFile(
  overrides: Partial<ChatWorkspaceFileTab>,
): ChatWorkspaceFileTab {
  return {
    key: "workspace-file",
    parentSessionKey: null,
    path: "/tmp/example.ts",
    label: "example.ts",
    viewMode: "preview",
    ...overrides,
  };
}

describe("ChatSessionWorkspaceFilePreview", () => {
  beforeEach(() => {
    serverPathReadMock.mockReset();
  });

  it("renders preview files inside a full-height workspace code surface", () => {
    serverPathReadMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        kind: "text",
        resolvedPath: "/tmp/example.ts",
        text: "const answer = 42;\n",
        truncated: false,
      },
    });

    render(
      <ChatSessionWorkspaceFilePreview
        file={buildWorkspaceFile({ viewMode: "preview" })}
        sessionProjectRoot="/tmp"
        onFileOpen={vi.fn()}
      />,
    );

    expect(screen.getByTestId("file-code-surface").getAttribute("data-layout")).toBe(
      "workspace",
    );
  });

  it("renders diff files inside a full-height workspace code surface", () => {
    serverPathReadMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: null,
    });

    render(
      <ChatSessionWorkspaceFilePreview
        file={buildWorkspaceFile({
          viewMode: "diff",
          beforeText: "const answer = 41;\n",
          afterText: "const answer = 42;\n",
          oldStartLine: 1,
          newStartLine: 1,
        })}
        sessionProjectRoot="/tmp"
        onFileOpen={vi.fn()}
      />,
    );

    expect(screen.getByTestId("file-code-surface").getAttribute("data-layout")).toBe(
      "workspace",
    );
  });
});
