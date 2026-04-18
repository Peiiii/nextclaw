import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSessionWorkspaceFilePreview } from "@/components/chat/chat-session-workspace-file-preview";
import type { ChatWorkspaceFileTab } from "@/components/chat/stores/chat-thread.store";
import { t } from "@/lib/i18n";

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

  it("does not repeat the preview badge inside the workspace header", () => {
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

    expect(screen.queryByText(t("chatWorkspacePreview"))).toBeNull();
    expect(screen.getByTitle("/tmp/example.ts")).toBeTruthy();
  });

  it("keeps the title-only header compact when no metadata is present", () => {
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

    const title = screen.getByTitle("/tmp/example.ts");
    const header = title.parentElement;

    expect(header).toBeTruthy();
    expect(header?.className).toContain("py-2.5");
    expect(header?.children).toHaveLength(1);
  });

  it("keeps line and truncation metadata without the duplicated type badge", () => {
    serverPathReadMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        kind: "text",
        resolvedPath: "/tmp/example.ts",
        text: "const answer = 42;\n",
        truncated: true,
      },
    });

    render(
      <ChatSessionWorkspaceFilePreview
        file={buildWorkspaceFile({
          viewMode: "preview",
          line: 12,
          column: 4,
        })}
        sessionProjectRoot="/tmp"
        onFileOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("L12:4")).toBeTruthy();
    expect(screen.getByText(t("chatWorkspacePreviewTruncated"))).toBeTruthy();
    expect(screen.queryByText(t("chatWorkspacePreview"))).toBeNull();
  });
});
