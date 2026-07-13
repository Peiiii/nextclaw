import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChatFileOpenActionViewModel,
  ChatFileOperationBlockViewModel,
} from "@nextclaw/agent-chat-ui";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import { t } from "@/shared/lib/i18n";

const serverPathReadMock = vi.fn();
const serverPathBrowseMock = vi.fn();
const renderDocxMock = vi.fn();
const readSpreadsheetMock = vi.fn();
const sheetToJsonMock = vi.fn();
const openPresentationMock = vi.fn();
const destroyPresentationMock = vi.fn();

type RenderWorkspaceFilePreviewOptions = {
  file?: Partial<ChatWorkspaceFileTab>;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  refreshVersion?: number;
  sessionProjectRoot?: string | null;
  sessionWorkingDir?: string | null;
};

type TextReadDataOverrides = {
  kind?: "text" | "markdown" | "binary";
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

vi.mock("docx-preview", () => ({
  renderAsync: (...args: unknown[]) => renderDocxMock(...args),
}));

vi.mock("xlsx", () => ({
  read: (...args: unknown[]) => readSpreadsheetMock(...args),
  utils: {
    sheet_to_json: (...args: unknown[]) => sheetToJsonMock(...args),
  },
}));

vi.mock("@aiden0z/pptx-renderer", () => ({
  PptxViewer: {
    open: (...args: unknown[]) => openPresentationMock(...args),
  },
  RECOMMENDED_ZIP_LIMITS: { maxEntries: 4_000 },
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
  serverPathBrowseMock.mockImplementation(
    ({ path }: { path?: string | null }) => {
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
    },
  );
}

beforeEach(() => {
  serverPathReadMock.mockReset();
  serverPathBrowseMock.mockReset();
  renderDocxMock.mockReset();
  renderDocxMock.mockResolvedValue(undefined);
  readSpreadsheetMock.mockReset();
  readSpreadsheetMock.mockReturnValue({
    SheetNames: ["Summary", "Details"],
    Sheets: { Summary: { name: "Summary" }, Details: { name: "Details" } },
  });
  sheetToJsonMock.mockReset();
  sheetToJsonMock.mockImplementation((sheet: { name: string }) =>
    sheet.name === "Summary"
      ? [
          ["City", "Temperature"],
          ["Hangzhou", "32 C"],
        ]
      : [["Status"], ["Sunny"]],
  );
  openPresentationMock.mockReset();
  destroyPresentationMock.mockReset();
  openPresentationMock.mockResolvedValue({ destroy: destroyPresentationMock });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
      ),
  );
  serverPathReadMock.mockReturnValue({
    isLoading: false,
    error: null,
    data: null,
  });
  serverPathBrowseMock.mockReturnValue({
    isLoading: false,
    error: new Error("server path must point to a directory"),
    data: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatSessionWorkspaceFilePreview rendering", () => {
  it("renders attachment content URLs as workspace-native media previews", () => {
    renderWorkspaceFilePreview({
      file: {
        key: "attachment-image",
        path: "photo.png",
        label: "photo.png",
        viewMode: "preview",
        contentUrl: "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Fphoto",
        mimeType: "image/png",
      },
    });

    expect(serverPathReadMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(serverPathBrowseMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    const image = screen.getByTestId("workspace-content-image");
    expect(image.getAttribute("src")).toBe(
      "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Fphoto",
    );
    expect(image.getAttribute("alt")).toBe("photo.png");
  });

  it("renders local SVG files through the automatic server-content viewer", () => {
    mockTextRead({
      resolvedPath: "/tmp/project/diagram.svg",
      text: '<svg xmlns="http://www.w3.org/2000/svg" />',
    });
    renderWorkspaceFilePreview({
      file: {
        path: "/tmp/project/diagram.svg",
        label: "diagram.svg",
        previewViewer: "auto",
      },
    });

    const image = screen.getByTestId("workspace-content-image");
    expect(image.getAttribute("src")).toContain(
      "/api/server-paths/content?path=%2Ftmp%2Fproject%2Fdiagram.svg",
    );
    expect(screen.queryByTestId("file-code-surface")).toBeNull();
  });

  it("renders SVG source when source viewer is explicitly requested", () => {
    mockTextRead({
      resolvedPath: "/tmp/project/diagram.svg",
      text: '<svg xmlns="http://www.w3.org/2000/svg" />',
    });
    renderWorkspaceFilePreview({
      file: {
        path: "/tmp/project/diagram.svg",
        label: "diagram.svg",
        previewViewer: "source",
      },
    });

    expect(screen.queryByTestId("workspace-content-image")).toBeNull();
    expect(screen.getByTestId("file-code-surface")).toBeTruthy();
  });
});

describe("ChatSessionWorkspaceFilePreview Office rendering", () => {
  it("renders DOCX attachments inside the workspace preview", async () => {
    renderDocxMock.mockImplementationOnce(
      async (_data: ArrayBuffer, bodyContainer: HTMLDivElement) => {
        const wrapper = document.createElement("div");
        wrapper.className = "docx-wrapper";
        const page = document.createElement("section");
        page.className = "docx";
        const table = document.createElement("table");
        const colgroup = document.createElement("colgroup");
        for (let index = 0; index < 6; index += 1) {
          colgroup.append(document.createElement("col"));
        }
        table.append(colgroup);
        page.append(table);
        wrapper.append(page);
        bodyContainer.append(wrapper);
      },
    );
    renderWorkspaceFilePreview({
      file: {
        key: "attachment-docx",
        path: "overview.zh-CN.docx",
        label: "overview.zh-CN.docx",
        viewMode: "preview",
        contentUrl:
          "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Foverview",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });

    expect(screen.getByTestId("workspace-content-docx")).toBeTruthy();
    await waitFor(() => expect(renderDocxMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("workspace-content-docx").className).toContain(
        "workspace-docx-preview--reflow",
      ),
    );
    expect(
      screen
        .getByTestId("workspace-content-docx")
        .querySelector(".workspace-docx-wide-table > table"),
    ).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Foverview",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.queryByTestId("workspace-content-unsupported")).toBeNull();
  });

  it("renders a relative local DOCX before binary metadata finishes loading", async () => {
    mockTextRead({
      kind: "binary",
      resolvedPath: "/tmp/report.docx",
      text: undefined,
    });
    renderWorkspaceFilePreview({
      file: {
        path: "report.docx",
        label: "report.docx",
        previewViewer: "auto",
      },
      sessionWorkingDir: "/tmp",
    });

    expect(screen.getByTestId("workspace-content-docx")).toBeTruthy();
    await waitFor(() => expect(renderDocxMock).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("path=report.docx&basePath=%2Ftmp"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.queryByText(t("chatWorkspacePreviewUnsupported"))).toBeNull();
  });

  it("preserves DOCX page geometry when the document defines it", async () => {
    renderDocxMock.mockImplementationOnce(
      async (_data: ArrayBuffer, bodyContainer: HTMLDivElement) => {
        const wrapper = document.createElement("div");
        wrapper.className = "docx-wrapper";
        const page = document.createElement("section");
        page.className = "docx";
        page.style.width = "612pt";
        page.style.padding = "72pt";
        wrapper.append(page);
        bodyContainer.append(wrapper);
      },
    );
    renderWorkspaceFilePreview({
      file: {
        key: "attachment-docx-with-page-layout",
        path: "page-layout.docx",
        label: "page-layout.docx",
        viewMode: "preview",
        contentUrl:
          "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Fpage-layout",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });

    await waitFor(() => expect(renderDocxMock).toHaveBeenCalled());
    expect(
      screen.getByTestId("workspace-content-docx").className,
    ).not.toContain("workspace-docx-preview--reflow");
  });

  it("renders Excel workbooks with sheet navigation", async () => {
    renderWorkspaceFilePreview({
      file: {
        key: "attachment-xlsx",
        path: "overview.xlsx",
        label: "overview.xlsx",
        viewMode: "preview",
        contentUrl:
          "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Foverview",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

    expect(screen.getByTestId("workspace-content-spreadsheet")).toBeTruthy();
    await waitFor(() => expect(readSpreadsheetMock).toHaveBeenCalled());
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
    expect(screen.getByText("Hangzhou")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Sunny")).toBeTruthy();
  });

  it("renders PowerPoint presentations in the workspace", async () => {
    renderWorkspaceFilePreview({
      file: {
        key: "attachment-pptx",
        path: "overview.pptx",
        label: "overview.pptx",
        viewMode: "preview",
        contentUrl: "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Fslides",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
    });

    expect(screen.getByTestId("workspace-content-presentation")).toBeTruthy();
    await waitFor(() => expect(openPresentationMock).toHaveBeenCalled());
    expect(openPresentationMock).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.any(HTMLElement),
      expect.objectContaining({
        lazySlides: true,
        lazyMedia: true,
        pdfjs: false,
        zipLimits: { maxEntries: 4_000 },
      }),
    );
  });

  it("offers download and system open actions for legacy PowerPoint attachments", () => {
    renderWorkspaceFilePreview({
      file: {
        key: "attachment-ppt",
        path: "overview.ppt",
        label: "overview.ppt",
        viewMode: "preview",
        contentUrl:
          "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Foverview",
        mimeType: "application/vnd.ms-powerpoint",
      },
    });

    expect(screen.getByTestId("workspace-content-unsupported")).toBeTruthy();
    expect(screen.getByText(t("chatWorkspacePreviewUnsupported"))).toBeTruthy();

    const download = screen.getByRole("link", {
      name: t("chatWorkspacePreviewDownload"),
    });
    expect(download.getAttribute("href")).toBe(
      "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Foverview",
    );
    expect(download.getAttribute("download")).toBe("overview.ppt");

    const openExternally = screen.getByRole("link", {
      name: t("chatWorkspacePreviewOpenExternally"),
    });
    expect(openExternally.getAttribute("href")).toBe(
      "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Foverview",
    );
    expect(openExternally.getAttribute("target")).toBe("_blank");
  });
});

describe("ChatSessionWorkspaceFilePreview text rendering", () => {
  it("renders preview files inside a full-height workspace code surface", () => {
    mockTextRead();
    renderWorkspaceFilePreview();

    expect(
      screen.getByTestId("file-code-surface").getAttribute("data-layout"),
    ).toBe("workspace");
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
      screen
        .getByTestId("file-code-surface")
        .getAttribute("data-language-hint"),
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
      "/api/server-paths/content?path=%2Ftmp%2Fexample.html",
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

    expect(
      screen.getByTestId("workspace-html-preview").getAttribute("src"),
    ).toContain("refresh=3");
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

    expect(
      screen.getByTestId("file-code-surface").getAttribute("data-layout"),
    ).toBe("workspace");
  });

  it("does not repeat the preview badge inside the workspace header", () => {
    mockTextRead();
    renderWorkspaceFilePreview();

    expect(screen.queryByText(t("chatWorkspacePreview"))).toBeNull();
    expect(screen.getByTitle("/tmp/example.ts")).toBeTruthy();
    expect(screen.getByText("tmp")).toBeTruthy();
    expect(screen.getByText("example.ts")).toBeTruthy();
  });

  it("renders directory entries, expands child directories, and opens files", () => {
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

    const componentsTreeItem = screen.getByRole("treeitem", {
      name: "Open directory: components",
    });
    const indexButton = screen.getByRole("button", { name: "index.ts" });
    fireEvent.click(componentsTreeItem.querySelector("button")!);
    expect(
      componentsTreeItem.getAttribute("aria-expanded"),
    ).toBe("true");
    expect(onFileOpen).not.toHaveBeenCalled();

    fireEvent.click(indexButton);
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
    expect(
      screen.getByTestId("workspace-file-breadcrumbs").className,
    ).toContain("workspace-horizontal-scrollbar");
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

    expect(
      screen.getByTestId("workspace-breadcrumb-popover").className,
    ).toContain("w-[22rem]");
    expect(
      screen.getByTestId("workspace-breadcrumb-browser").className,
    ).toContain("max-h-72");
    expect(
      screen.getAllByRole("button", { name: "workspace" }).at(-1)?.className,
    ).toContain("h-5");
    expect(
      screen.getByRole("button", { name: "components" }).className,
    ).toContain("h-6");
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
