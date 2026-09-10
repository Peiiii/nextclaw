import type * as ReactQuery from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_OBJECT_RESOURCE_RENDERERS } from "@/features/right-panel-resources/components/system-object-resource";
import type { DocBrowserCustomTabRenderParams } from "@/shared/components/doc-browser/doc-browser-renderer.types";

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
  ChatSessionWorkspaceFilePreview: ({ file }: { file: { key: string; rawText: string } }) => (
    <div data-testid="preview" data-resource-key={file.key}>{file.rawText}</div>
  ),
}));
afterEach(cleanup);

describe("system object reading identity", () => {
  it("isolates same-named snapshots by resource URI and preserves identity on reopen", () => {
    const content = (uri: string) => SYSTEM_OBJECT_RESOURCE_RENDERERS["system-object"].renderContent!({
      currentUrl: uri,
      tab: { id: uri, kind: "system-object", title: "Agent", currentUrl: uri, resourceUri: uri, history: [uri], historyIndex: 0, navVersion: 0 },
      open: vi.fn(),
      openTarget: vi.fn(),
      refreshIframe: vi.fn(),
    } satisfies DocBrowserCustomTabRenderParams);
    const first = "nextclaw://objects/agent/first";
    const second = "nextclaw://objects/agent/second";
    const view = render(content(first));
    expect(screen.getByTestId("preview").getAttribute("data-resource-key")).toBe(first);
    view.rerender(content(second));
    expect(screen.getByTestId("preview").getAttribute("data-resource-key")).toBe(second);
    view.rerender(content(first));
    expect(screen.getByTestId("preview").getAttribute("data-resource-key")).toBe(first);
    expect(screen.getByTestId("preview").textContent).toBe("# Agent snapshot");
  });
});
