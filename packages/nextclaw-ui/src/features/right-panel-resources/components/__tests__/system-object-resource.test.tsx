import type * as ReactQuery from "@tanstack/react-query";
import type { ReactNode } from "react";
import type * as ReactRouter from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_OBJECT_RESOURCE_RENDERERS } from "@/features/right-panel-resources/components/system-object-resource";
import { WORKSPACE_FILE_PANEL_RENDERERS } from "@/features/right-panel-resources/components/workspace-file-resource";
import { createWorkspaceFilePanelTarget } from "@/features/chat";
import type { DocBrowserCustomTabRenderParams } from "@/shared/components/doc-browser/doc-browser-renderer.types";
import type { WorkspaceTextExcerpt } from "@/features/chat";
import { NativeObjectResource } from "@/features/right-panel-resources/components/native-object-resource";

vi.mock("@/features/agents", () => ({ AgentsPage: ({ resourceId }: { resourceId: string }) => <div>agent:{resourceId}</div> }));
vi.mock("@/features/cron", () => ({ CronJobResource: ({ jobId }: { jobId: string }) => <div>cron-job:{jobId}</div> }));
vi.mock("@/features/projects", () => ({ ProjectsPage: ({ resourceId, resourceWorkId }: { resourceId: string; resourceWorkId?: string }) => <div>project:{resourceId}{resourceWorkId ? `/${resourceWorkId}` : ""}</div> }));
vi.mock("@/features/inbox", () => ({ InboxPage: ({ resourceId }: { resourceId: string }) => <div>inbox-delivery:{resourceId}</div> }));
vi.mock("@/features/apps", () => ({ AppsPanel: ({ serviceResourceId }: { serviceResourceId: string }) => <div>service-app:{serviceResourceId}</div> }));
vi.mock("@/features/marketplace", () => ({ McpMarketplacePage: ({ resourceId }: { resourceId: string }) => <div>mcp-server:{resourceId}</div> }));
vi.mock("@/features/panel-apps", () => ({
  PanelAppRuntimeSurface: ({ appId, refreshVersion }: { appId: string; refreshVersion?: number }) => <div>panel-app:{appId}:{refreshVersion}</div>,
  PanelAppHostProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/features/panel-apps/components/panel-app-toolbar", () => ({
  PanelAppDocBrowserToolbar: ({ appId, onRefresh }: { appId: string; onRefresh: () => void }) => (
    <button onClick={onRefresh}>refresh:{appId}</button>
  ),
}));

const actions = vi.hoisted(() => ({ addExcerptToChat: vi.fn(), navigate: vi.fn() }));
vi.mock("@/features/chat", async () => ({
  ...await import("@/features/chat/features/workspace/utils/workspace-file-panel-route.utils"),
  ...await import("@/features/chat/features/workspace/utils/chat-workspace-file-tab.utils"),
  ...await import("@/features/chat/features/workspace/utils/workspace-text-excerpt.utils"),
  ...await import("@/features/chat/features/workspace/components/chat-session-workspace-file-preview"),
}));
vi.mock("@/app/components/app-presenter-provider", () => ({
  useAppPresenter: () => ({ pageResourceManager: actions }),
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...await importOriginal<typeof ReactRouter>(),
  useLocation: () => ({ pathname: "/chat/current-session" }),
  useNavigate: () => actions.navigate,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...await importOriginal<typeof ReactQuery>(),
  useQuery: () => ({
    data: {
      reference: { fileName: "agent.md", label: "Agent", mimeType: "text/markdown" },
      content: "# Agent snapshot",
    },
  }),
}));
vi.mock("@/features/chat/features/workspace/components/chat-session-workspace-file-preview", () => ({
  ChatSessionWorkspaceFilePreview: ({ file, onTextExcerptAdd }: {
    file: { key: string; rawText: string };
    onTextExcerptAdd?: (excerpt: WorkspaceTextExcerpt) => void;
  }) => (
    <div data-testid="preview" data-resource-key={file.key}>{file.rawText}
      <button onClick={() => onTextExcerptAdd?.({ path: "agent.md", label: "agent.md", excerpt: "Agent snapshot", startLine: 1, endLine: 1 })}>Add selection</button>
    </div>
  ),
}));
afterEach(cleanup);

describe("system object reading identity", () => {
  it.each(["agent", "cron-job", "project", "inbox-delivery", "service-app", "mcp-server", "panel-app"])("opens %s with its native renderer and unchanged identity", async (objectType) => {
    render(<NativeObjectResource objectType={objectType} objectId="raw:id" openTarget={vi.fn()} />);
    expect(await screen.findByText(objectType === "panel-app" ? `${objectType}:raw:id:` : `${objectType}:raw:id`)).toBeTruthy();
    expect(screen.queryByTestId("preview")).toBeNull();
  });

  it("keeps project and work item identities separate", async () => {
    render(<NativeObjectResource objectType="project-work" objectId={JSON.stringify(["project", "work"])} openTarget={vi.fn()} />);
    expect(await screen.findByText("project:project/work")).toBeTruthy();
  });

  it("places refresh in the host toolbar and passes its version to panel app content", async () => {
    const uri = "nextclaw://objects/panel-app/raw%3Aid";
    const refreshIframe = vi.fn();
    const params = (refreshVersion: number) => ({
      currentUrl: uri,
      tab: { id: uri, kind: "system-object", title: "Panel App", currentUrl: uri, resourceUri: uri, history: [uri], historyIndex: 0, navVersion: 0 },
      open: vi.fn(), openTarget: vi.fn(), refreshIframe, refreshVersion,
    } satisfies DocBrowserCustomTabRenderParams);
    render(SYSTEM_OBJECT_RESOURCE_RENDERERS["system-object"].renderToolbar!(params(0)));
    fireEvent.click(screen.getByRole("button", { name: "refresh:raw:id" }));
    expect(refreshIframe).toHaveBeenCalledTimes(1);
    const view = render(SYSTEM_OBJECT_RESOURCE_RENDERERS["system-object"].renderContent!(params(0)));
    expect(await screen.findByText("panel-app:raw:id:0")).toBeTruthy();
    view.rerender(SYSTEM_OBJECT_RESOURCE_RENDERERS["system-object"].renderContent!(params(1)));
    expect(await screen.findByText("panel-app:raw:id:1")).toBeTruthy();
  });

  it("retains a global file's source context when quoting into a different conversation", () => {
    const target = createWorkspaceFilePanelTarget({
      key: "source-file", path: "agent.md", label: "agent.md", parentSessionKey: "source-session", viewMode: "preview",
    }, { workingDir: "/source/workspace", projectRoot: "/source/workspace" });
    render(WORKSPACE_FILE_PANEL_RENDERERS["workspace-file"].renderContent!({
      currentUrl: target.url,
      tab: { ...target, id: target.url, currentUrl: target.url, history: [target.url], historyIndex: 0, navVersion: 0 },
      open: vi.fn(), openTarget: vi.fn(), refreshIframe: vi.fn(), refreshVersion: 0,
    }));
    fireEvent.click(screen.getByRole("button", { name: "Add selection" }));
    expect(actions.addExcerptToChat).toHaveBeenLastCalledWith({
      path: target.resourceUri, label: "agent.md", excerpt: "Agent snapshot", startLine: 1, endLine: 1,
    }, "/chat/current-session", actions.navigate);
  });

  it("isolates same-named snapshots by resource URI and preserves identity on reopen", () => {
    const content = (uri: string) => SYSTEM_OBJECT_RESOURCE_RENDERERS["system-object"].renderContent!({
      currentUrl: uri,
      tab: { id: uri, kind: "system-object", title: "Agent", currentUrl: uri, resourceUri: uri, history: [uri], historyIndex: 0, navVersion: 0 },
      open: vi.fn(),
      openTarget: vi.fn(),
      refreshIframe: vi.fn(),
      refreshVersion: 0,
    } satisfies DocBrowserCustomTabRenderParams);
    const first = "nextclaw://objects/skill/first";
    const second = "nextclaw://objects/skill/second";
    const view = render(content(first));
    expect(screen.getByTestId("preview").getAttribute("data-resource-key")).toBe(first);
    view.rerender(content(second));
    expect(screen.getByTestId("preview").getAttribute("data-resource-key")).toBe(second);
    view.rerender(content(first));
    expect(screen.getByTestId("preview").getAttribute("data-resource-key")).toBe(first);
    expect(screen.getByTestId("preview").textContent).toContain("# Agent snapshot");
    fireEvent.click(screen.getByRole("button", { name: "Add selection" }));
    expect(actions.addExcerptToChat).toHaveBeenCalledWith({
      path: first, label: "Agent", excerpt: "Agent snapshot", startLine: null, endLine: null,
    }, "/chat/current-session", actions.navigate);
  });
});
