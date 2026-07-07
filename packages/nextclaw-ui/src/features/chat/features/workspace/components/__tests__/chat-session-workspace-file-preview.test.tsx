import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChatFileOpenActionViewModel,
  ChatFileOperationBlockViewModel,
} from "@nextclaw/agent-chat-ui";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import { t } from "@/shared/lib/i18n";

const serverPathReadMock = vi.fn();
const serverPathBrowseMock = vi.fn();

type RenderWorkspaceFilePreviewOptions = {
  file?: Partial<ChatWorkspaceFileTab>;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  refreshVersion?: number;
  sessionProjectRoot?: string | null;
  sessionWorkingDir?: string | null;
};

type TextReadDataOverrides = {
  languageHint?: string;
  resolvedPath?: string;
  text?: string;
  truncated?: boolean;
};

vi.mock("@/shared/hooks/use-server-path-read", () => ({
  useServerPathRead: (...args: unknown[]) => serverPathReadMock(...args),
}));

vi.mock("@/shared/hooks/use-server-path-browse", () => ({
  useServerPathBrowse: (...args: unknown[]) => serverPathBrowseMock(...args),
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  ChatMessageMarkdown: ({ text }: { text: string }) => (
    <div data-testid="markdown-preview">{text}</div>
  ),
  FileOperationCodeSurface: ({
    block,
    layout,
  }: {
    block: ChatFileOperationBlockViewModel;
    layout?: "compact" | "workspace";
  }) => (
    <div
      data-testid="file-code-surface"
      data-language-hint={block.languageHint ?? ""}
      data-layout={layout ?? "compact"}
    />
  ),
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

function mockTextRead(overrides: TextReadDataOverrides = {}) {
  serverPathReadMock.mockReturnValue({
    isLoading: false,
    error: null,
    data: {
      kind: "text",
      resolvedPath: "/tmp/example.ts",
      text: "const answer = 42;\n",
      truncated: false,
      ...overrides,
    },
  });
}

function renderWorkspaceFilePreview({
  file,
  onFileOpen = vi.fn(),
  refreshVersion,
  sessionProjectRoot = "/tmp",
  sessionWorkingDir = "/tmp",
}: RenderWorkspaceFilePreviewOptions = {}) {
  render(
    <ChatSessionWorkspaceFilePreview
      file={buildWorkspaceFile(file ?? {})}
      sessionProjectRoot={sessionProjectRoot}
      sessionWorkingDir={sessionWorkingDir}
      refreshVersion={refreshVersion}
      onFileOpen={onFileOpen}
    />,
  );
  return { onFileOpen };
}

function mockWorkspaceBreadcrumbBrowseTree() {
  serverPathBrowseMock.mockImplementation(({ path }: { path?: string | null }) => {
    if (path === "/tmp/workspace/src/components") {
      return {
        isLoading: false,
        error: null,
        data: {
          currentPath: "/tmp/workspace/src/components",
          parentPath: "/tmp/workspace/src",
          homePath: "/Users/demo",
          breadcrumbs: [
            { label: "workspace", path: "/tmp/workspace" },
            { label: "src", path: "/tmp/workspace/src" },
            { label: "components", path: "/tmp/workspace/src/components" },
          ],
          entries: [
            {
              name: "button.tsx",
              path: "/tmp/workspace/src/components/button.tsx",
              kind: "file",
              hidden: false,
            },
          ],
        },
      };
    }

    if (path === "/tmp/workspace/src") {
      return {
        isLoading: false,
        error: null,
        data: {
          currentPath: "/tmp/workspace/src",
          parentPath: "/tmp/workspace",
          homePath: "/Users/demo",
          breadcrumbs: [
            { label: "workspace", path: "/tmp/workspace" },
            { label: "src", path: "/tmp/workspace/src" },
          ],
          entries: [
            {
              name: "components",
              path: "/tmp/workspace/src/components",
              kind: "directory",
              hidden: false,
            },
            {
              name: "index.ts",
              path: "/tmp/workspace/src/index.ts",
              kind: "file",
              hidden: false,
            },
          ],
        },
      };
    }

    return {
      isLoading: false,
      error: new Error("server path must point to a directory"),
      data: null,
    };
  });
}

beforeEach(() => {
  serverPathReadMock.mockReset();
  serverPathBrowseMock.mockReset();
  serverPathBrowseMock.mockReturnValue({
    isLoading: false,
    error: new Error("server path must point to a directory"),
    data: null,
  });
});

describe("ChatSessionWorkspaceFilePreview rendering", () => {
  it("renders preview files inside a full-height workspace code surface", () => {
    mockTextRead();
    renderWorkspaceFilePreview();

    expect(screen.getByTestId("file-code-surface").getAttribute("data-layout")).toBe(
      "workspace",
    );
  });

  it("passes server language hints to the workspace code surface", () => {
    mockTextRead({ languageHint: "js", resolvedPath: "/tmp/example.js" });
    renderWorkspaceFilePreview({
      file: {
        label: "example.js",
        path: "/tmp/example.js",
        viewMode: "preview",
      },
    });

    expect(
      screen.getByTestId("file-code-surface").getAttribute("data-language-hint"),
    ).toBe("js");
  });

  it("keeps HTML files in the source preview when preview viewer is automatic", () => {
    mockTextRead({
      resolvedPath: "/tmp/example.html",
      text: "<!doctype html><h1>Hello</h1>",
    });
    renderWorkspaceFilePreview({
      file: {
        label: "example.html",
        path: "/tmp/example.html",
        viewMode: "preview",
      },
    });

    expect(screen.queryByTestId("workspace-html-preview")).toBeNull();
    expect(screen.getByTestId("file-code-surface")).toBeTruthy();
  });

  it("renders HTML files through an unrestricted server content iframe when rendered preview is requested", () => {
    mockTextRead({
      resolvedPath: "/tmp/example.html",
      text: "<!doctype html><h1>Hello</h1>",
    });
    renderWorkspaceFilePreview({
      file: {
        label: "example.html",
        path: "/tmp/example.html",
        previewViewer: "rendered",
        viewMode: "preview",
      },
    });

    const frame = screen.getByTestId("workspace-html-preview");
    expect(frame.getAttribute("sandbox")).toBeNull();
    expect(frame.getAttribute("srcdoc")).toBeNull();
    expect(frame.getAttribute("src")).toContain(
      "/api/server-paths/content/__abs__/tmp/example.html",
    );
    expect(screen.queryByTestId("file-code-surface")).toBeNull();
  });

  it("adds the refresh version to rendered HTML iframe URLs", () => {
    mockTextRead({
      resolvedPath: "/tmp/example.html",
      text: "<!doctype html><h1>Hello</h1>",
    });
    renderWorkspaceFilePreview({
      file: {
        label: "example.html",
        path: "/tmp/example.html",
        previewViewer: "rendered",
        viewMode: "preview",
      },
      refreshVersion: 3,
    });

    expect(screen.getByTestId("workspace-html-preview").getAttribute("src")).toContain(
      "refresh=3",
    );
  });

  it("keeps HTML files in the source preview when source is requested", () => {
    mockTextRead({
      resolvedPath: "/tmp/example.html",
      text: "<!doctype html><h1>Hello</h1>",
    });
    renderWorkspaceFilePreview({
      file: {
        path: "/tmp/example.html",
        previewViewer: "source",
        viewMode: "preview",
      },
    });

    expect(screen.queryByTestId("workspace-html-preview")).toBeNull();
    expect(screen.getByTestId("file-code-surface")).toBeTruthy();
  });

  it("falls back to the source preview when rendered is requested for a non-HTML file", () => {
    mockTextRead({ resolvedPath: "/tmp/example.txt", text: "plain text" });
    renderWorkspaceFilePreview({
      file: {
        path: "/tmp/example.txt",
        previewViewer: "rendered",
        viewMode: "preview",
      },
    });

    expect(screen.queryByTestId("workspace-html-preview")).toBeNull();
    expect(screen.getByTestId("file-code-surface")).toBeTruthy();
  });

  it("renders diff files inside a full-height workspace code surface", () => {
    serverPathReadMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: null,
    });

    renderWorkspaceFilePreview({
      file: {
        viewMode: "diff",
        beforeText: "const answer = 41;\n",
        afterText: "const answer = 42;\n",
        oldStartLine: 1,
        newStartLine: 1,
      },
    });

    expect(screen.getByTestId("file-code-surface").getAttribute("data-layout")).toBe(
      "workspace",
    );
  });

  it("does not repeat the preview badge inside the workspace header", () => {
    mockTextRead();
    renderWorkspaceFilePreview();

    expect(screen.queryByText(t("chatWorkspacePreview"))).toBeNull();
    expect(screen.getByTitle("/tmp/example.ts")).toBeTruthy();
    expect(screen.getByText("tmp")).toBeTruthy();
    expect(screen.getByText("example.ts")).toBeTruthy();
  });

  it("renders directory entries and opens child directories or files", () => {
    serverPathReadMock.mockReturnValue({
      isLoading: false,
      error: new Error("server path must point to a file"),
      data: null,
    });
    serverPathBrowseMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        currentPath: "/tmp/workspace/src",
        parentPath: "/tmp/workspace",
        homePath: "/Users/demo",
        breadcrumbs: [
          { label: "workspace", path: "/tmp/workspace" },
          { label: "src", path: "/tmp/workspace/src" },
        ],
        entries: [
          {
            name: "components",
            path: "/tmp/workspace/src/components",
            kind: "directory",
            hidden: false,
          },
          {
            name: "index.ts",
            path: "/tmp/workspace/src/index.ts",
            kind: "file",
            hidden: false,
          },
        ],
      },
    });
    const onFileOpen = vi.fn();

    renderWorkspaceFilePreview({
      file: {
        path: "src",
        label: "src",
        viewMode: "preview",
      },
      onFileOpen,
      sessionProjectRoot: "/tmp/workspace",
      sessionWorkingDir: "/tmp/workspace",
    });

    expect(serverPathBrowseMock).toHaveBeenCalledWith({
      path: "src",
      basePath: "/tmp/workspace",
      includeFiles: true,
      enabled: true,
    });
    expect(screen.getByTestId("workspace-directory-browser")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Open directory: components" }),
    );
    expect(onFileOpen).toHaveBeenCalledWith({
      path: "/tmp/workspace/src/components",
      label: "components",
      viewMode: "preview",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Open file: index.ts" }),
    );
    expect(onFileOpen).toHaveBeenCalledWith({
      path: "/tmp/workspace/src/index.ts",
      label: "index.ts",
      viewMode: "preview",
    });
  });
});

describe("ChatSessionWorkspaceFilePreview breadcrumbs", () => {
  it("renders project-relative breadcrumbs when the file is inside the workspace", () => {
    mockTextRead({ resolvedPath: "/tmp/workspace/src/example.ts" });
    renderWorkspaceFilePreview({
      sessionProjectRoot: "/tmp/workspace",
      sessionWorkingDir: "/tmp/workspace",
    });

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

  it("browses from a breadcrumb segment and opens selected files", () => {
    mockTextRead({ resolvedPath: "/tmp/workspace/src/example.ts" });
    mockWorkspaceBreadcrumbBrowseTree();
    const onFileOpen = vi.fn();

    renderWorkspaceFilePreview({
      onFileOpen,
      sessionProjectRoot: "/tmp/workspace",
      sessionWorkingDir: "/tmp/workspace",
    });

    fireEvent.click(screen.getByRole("button", { name: "src" }));

    expect(serverPathBrowseMock).toHaveBeenCalledWith({
      path: "/tmp/workspace/src",
      includeFiles: true,
      enabled: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "components" }));
    fireEvent.click(screen.getByRole("button", { name: "button.tsx" }));

    expect(onFileOpen).toHaveBeenCalledWith({
      path: "/tmp/workspace/src/components/button.tsx",
      label: "button.tsx",
      viewMode: "preview",
    });
  });

  it("keeps the breadcrumb browser compact", () => {
    mockTextRead({ resolvedPath: "/tmp/workspace/src/example.ts" });
    mockWorkspaceBreadcrumbBrowseTree();

    renderWorkspaceFilePreview({
      sessionProjectRoot: "/tmp/workspace",
      sessionWorkingDir: "/tmp/workspace",
    });

    fireEvent.click(screen.getByRole("button", { name: "src" }));

    expect(screen.getByTestId("workspace-breadcrumb-popover").className).toContain(
      "w-[22rem]",
    );
    expect(screen.getByTestId("workspace-breadcrumb-browser").className).toContain(
      "max-h-72",
    );
    expect(screen.getAllByRole("button", { name: "workspace" }).at(-1)?.className).toContain(
      "h-5",
    );
    expect(screen.getByRole("button", { name: "components" }).className).toContain(
      "h-6",
    );
  });

  it("keeps line and truncation metadata without the duplicated type badge", () => {
    mockTextRead({ truncated: true });
    renderWorkspaceFilePreview({
      file: {
        viewMode: "preview",
        line: 12,
        column: 4,
      },
    });

    expect(screen.getByText("L12:4")).toBeTruthy();
    expect(screen.getByText(t("chatWorkspacePreviewTruncated"))).toBeTruthy();
    expect(screen.queryByText(t("chatWorkspacePreview"))).toBeNull();
  });

  it("uses the session working directory as the base path when no project root is set", () => {
    mockTextRead({
      resolvedPath: "/tmp/agent-workspace/AGENTS.md",
      text: "# Agent rules\n",
    });
    renderWorkspaceFilePreview({
      file: {
        path: "AGENTS.md",
        label: "AGENTS.md",
        viewMode: "preview",
      },
      sessionProjectRoot: null,
      sessionWorkingDir: "/tmp/agent-workspace",
    });

    expect(serverPathReadMock).toHaveBeenCalledWith({
      path: "AGENTS.md",
      basePath: "/tmp/agent-workspace",
      enabled: true,
    });
    expect(screen.getByText("agent-workspace")).toBeTruthy();
    expect(screen.getByText("AGENTS.md")).toBeTruthy();
  });
});
