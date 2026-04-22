import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSessionWorkspaceFilePreview } from "./chat-session-workspace-file-preview";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import { t } from "@/shared/lib/i18n";

const serverPathReadMock = vi.fn();

vi.mock("@/shared/hooks/server-path/use-server-path-read", () => ({
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
    expect(screen.getByText("tmp")).toBeTruthy();
    expect(screen.getByText("example.ts")).toBeTruthy();
  });

  it("renders project-relative breadcrumbs when the file is inside the workspace", () => {
    serverPathReadMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        kind: "text",
        resolvedPath: "/tmp/workspace/src/example.ts",
        text: "const answer = 42;\n",
        truncated: false,
      },
    });

    render(
      <ChatSessionWorkspaceFilePreview
        file={buildWorkspaceFile({ viewMode: "preview" })}
        sessionProjectRoot="/tmp/workspace"
        onFileOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("workspace")).toBeTruthy();
    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.getByText("example.ts")).toBeTruthy();
    expect(
      screen.getByTestId("workspace-file-breadcrumb-scroll").className,
    ).toContain("py-1.5");
    expect(screen.getByTestId("workspace-file-breadcrumbs").className).toContain(
      "workspace-horizontal-scrollbar",
    );
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
