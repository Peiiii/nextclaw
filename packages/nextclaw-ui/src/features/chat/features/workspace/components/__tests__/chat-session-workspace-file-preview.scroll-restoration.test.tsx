import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import { scrollRestorationManager } from "@/shared/lib/navigation-history";

const serverPathReadMock = vi.fn();
const serverPathBrowseMock = vi.fn();

vi.mock("@/shared/hooks/use-server-path-read", () => ({
  useServerPathRead: (...args: unknown[]) => serverPathReadMock(...args),
}));

vi.mock("@/shared/hooks/use-server-path-browse", () => ({
  useServerPathBrowse: (...args: unknown[]) => serverPathBrowseMock(...args),
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  ChatMessageMarkdown: ({ text }: { text: string }) => <div data-testid="markdown-preview">{text}</div>,
  FileOperationCodeSurface: () => null,
}));

vi.mock(
  "@/features/chat/features/workspace/components/workspace-text-selection-menu",
  () => ({
    WorkspaceTextSelectionMenu: ({ children }: { children: ReactNode }) => children,
  }),
);

function renderMarkdownPreview(file: {
  key: string;
  path: string;
  previewViewer?: "rendered" | "source";
} = {
  key: "markdown-tab",
  path: "/tmp/README.md",
  previewViewer: "rendered",
}) {
  return render(
    <ChatSessionWorkspaceFilePreview
      file={{
        key: file.key,
        parentSessionKey: "session-1",
        path: file.path,
        viewMode: "preview",
        previewViewer: file.previewViewer ?? "rendered",
      }}
      sessionProjectRoot="/tmp"
      sessionWorkingDir="/tmp"
      showBreadcrumbs={false}
      onFileOpen={vi.fn()}
    />,
  );
}

describe("ChatSessionWorkspaceFilePreview Markdown scroll restoration", () => {
  beforeEach(() => {
    scrollRestorationManager.clear();
    serverPathReadMock.mockImplementation(({ path }: { path: string }) => ({
      isLoading: false,
      error: null,
      data: {
        kind: "markdown",
        resolvedPath: path,
        startLine: 1,
        text: `# ${path}`,
        truncated: false,
      },
    }));
    serverPathBrowseMock.mockReturnValue({
      isLoading: false,
      error: new Error("not a directory"),
      data: null,
    });
  });

  it("restores the rendered Markdown position when returning to the same file tab", () => {
    const firstView = renderMarkdownPreview();
    const firstScrollContainer = screen.getByTestId("markdown-preview").parentElement as HTMLDivElement;
    firstScrollContainer.scrollTop = 144;
    fireEvent.scroll(firstScrollContainer);
    firstView.unmount();

    renderMarkdownPreview();

    expect((screen.getByTestId("markdown-preview").parentElement as HTMLDivElement).scrollTop).toBe(144);
  });

  it("keeps each Markdown tab's position when switching files in one preview instance", () => {
    const firstFile = { key: "markdown-a", path: "/tmp/A.md" };
    const secondFile = { key: "markdown-b", path: "/tmp/B.md" };
    const resolvedPaths = new Map([
      [firstFile.path, "/tmp/first-location/A.md"],
      [secondFile.path, "/tmp/B.md"],
    ]);
    serverPathReadMock.mockImplementation(({ path }: { path: string }) => ({
      isLoading: false,
      error: null,
      data: {
        kind: "markdown",
        resolvedPath: resolvedPaths.get(path) ?? path,
        startLine: 1,
        text: `# ${path}`,
        truncated: false,
      },
    }));
    const view = renderMarkdownPreview(firstFile);
    const firstScrollContainer = screen.getByTestId("markdown-preview").parentElement as HTMLDivElement;
    firstScrollContainer.scrollTop = 144;
    fireEvent.scroll(firstScrollContainer);

    view.rerender(
      <ChatSessionWorkspaceFilePreview
        file={{ ...secondFile, parentSessionKey: "session-1", viewMode: "preview" }}
        sessionProjectRoot="/tmp"
        sessionWorkingDir="/tmp"
        showBreadcrumbs={false}
        onFileOpen={vi.fn()}
      />,
    );
    const secondScrollContainer = screen.getByTestId("markdown-preview").parentElement as HTMLDivElement;
    secondScrollContainer.scrollTop = 72;
    fireEvent.scroll(secondScrollContainer);

    // Server-path data can be stale while the query swaps back to the first
    // tab. Its resolved path is display data, not tab identity.
    resolvedPaths.set(firstFile.path, "/tmp/returned-location/A.md");

    view.rerender(
      <ChatSessionWorkspaceFilePreview
        file={{ ...firstFile, parentSessionKey: "session-1", viewMode: "preview" }}
        sessionProjectRoot="/tmp"
        sessionWorkingDir="/tmp"
        showBreadcrumbs={false}
        onFileOpen={vi.fn()}
      />,
    );

    expect((screen.getByTestId("markdown-preview").parentElement as HTMLDivElement).scrollTop).toBe(144);
  });

  it("restores Markdown after returning from its source-view tab", () => {
    const renderedFile = {
      key: "markdown-rendered",
      path: "/tmp/README.md",
      previewViewer: "rendered" as const,
    };
    const sourceFile = {
      key: "markdown-source",
      path: "/tmp/README.md",
      previewViewer: "source" as const,
    };
    const view = renderMarkdownPreview(renderedFile);
    const scrollContainer = screen.getByTestId("markdown-preview").parentElement as HTMLDivElement;
    scrollContainer.scrollTop = 144;
    fireEvent.scroll(scrollContainer);

    // The source-view switch replaces the rendered scroll surface before the
    // rendered effect cleanup executes.
    scrollContainer.scrollTop = 0;
    view.rerender(
      <ChatSessionWorkspaceFilePreview
        file={{ ...sourceFile, parentSessionKey: "session-1", viewMode: "preview" }}
        sessionProjectRoot="/tmp"
        sessionWorkingDir="/tmp"
        showBreadcrumbs={false}
        onFileOpen={vi.fn()}
      />,
    );
    view.rerender(
      <ChatSessionWorkspaceFilePreview
        file={{ ...renderedFile, parentSessionKey: "session-1", viewMode: "preview" }}
        sessionProjectRoot="/tmp"
        sessionWorkingDir="/tmp"
        showBreadcrumbs={false}
        onFileOpen={vi.fn()}
      />,
    );

    expect((screen.getByTestId("markdown-preview").parentElement as HTMLDivElement).scrollTop).toBe(144);
  });
});
