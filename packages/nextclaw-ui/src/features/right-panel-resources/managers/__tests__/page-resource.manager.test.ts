import type { ChatThreadManager } from "@/features/chat";
import { useChatThreadStore } from "@/features/chat";
import { nextclawClient } from "@/shared/lib/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppPresenter } from "@/app/presenters/app.presenter";
import { PageResourceManager } from "@/features/right-panel-resources/managers/page-resource.manager";
import { RightPanelResourceRouteResolver } from "@/features/right-panel-resources/utils/right-panel-resource-route-resolver.utils";
import { usePageNavigationStore } from "@/features/right-panel-resources/stores/page-navigation.store";
import { useDocBrowserStore } from "@/shared/components/doc-browser/stores/doc-browser.store";
import { createDefaultDocBrowserState } from "@/shared/components/doc-browser/utils/doc-browser-state.utils";
import { pageResourceTab } from "@/features/right-panel-resources/managers/page-resource.manager";
import {
  buildSessionPanelUrl,
  buildSessionPath,
} from "@/features/chat";

function setup() {
  const app = {
    rightPanelResourceRouteResolver: new RightPanelResourceRouteResolver(),
    docBrowserManager: { openTarget: vi.fn() },
    workbenchSurfaceManager: {
      restore: vi.fn(),
      toggleMaximize: vi.fn(),
      place: vi.fn(),
      isVisible: vi.fn(() => false),
    },
    chatComposerIntentManager: {
      requestUiResourceReference: vi.fn(),
      requestFileReference: vi.fn(),
      requestSystemObjectReference: vi.fn(),
    },
  };
  return {
    app,
    manager: new PageResourceManager(app as unknown as AppPresenter),
    navigate: vi.fn(),
  };
}

describe("shared resource opening policy", () => {
  beforeEach(() => {
    usePageNavigationStore.setState({ pinned: [] });
    useDocBrowserStore.setState({ snapshot: createDefaultDocBrowserState() });
  });
  it("opens contextual workspace pages through their owner and maximizes instead of pretending to render a separate main page", () => {
    const { manager, app, navigate } = setup();
    const openWorkspacePage = vi.fn(() => useChatThreadStore.getState().setSnapshot({ workspacePanelParentKey: "parent" }));
    manager.bindWorkspace({ openWorkspacePage } as unknown as ChatThreadManager);
    const page = manager.resolve("nextclaw://workspace?page=overview&session=parent")!;
    manager.open(page, "main", navigate);
    expect(openWorkspacePage).toHaveBeenCalledWith("parent", "overview");
    expect(app.workbenchSurfaceManager.place).toHaveBeenCalledWith("session-workspace:parent", "docked");
    expect(app.workbenchSurfaceManager.toggleMaximize).toHaveBeenCalledWith("session-workspace:parent");
    expect(navigate).toHaveBeenCalledWith(buildSessionPath("parent"));
  });
  it("opens an ordinary Panel App URI in the global sidebar by default, preserving explicit main navigation", () => {
    const { manager, app, navigate } = setup();
    const page = manager.resolve("nextclaw://panel-app/example-notes")!;
    expect(page.target.kind).toBe("panel-app");
    manager.open(page, "default", navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(app.docBrowserManager.openTarget).toHaveBeenCalledWith(page.target, { newTab: true, placement: "docked" });
    manager.open(page, "main", navigate);
    expect(navigate).toHaveBeenCalledWith("/apps/panel/example-notes");
  });
  it("reuses an already open resource before default main navigation, while an explicit choice overrides it", () => {
    const { manager, app, navigate } = setup();
    const page = manager.resolve("nextclaw://panel-app/example-notes")!;
    useDocBrowserStore.setState({
      snapshot: {
        ...createDefaultDocBrowserState(),
        isOpen: true,
        tabs: [pageResourceTab(page)],
      },
    });
    manager.open(page, "default", navigate);
    expect(app.docBrowserManager.openTarget).toHaveBeenCalledWith(page.target, {
      newTab: true,
    });
    expect(navigate).not.toHaveBeenCalled();
    manager.open(page, "main", navigate);
    expect(navigate).toHaveBeenCalledWith("/apps/panel/example-notes");
  });
  it("reconstructs conversations and pins generic pages without a Panel App identity", () => {
    const { manager, navigate } = setup();
    const conversation = manager.resolve(
      buildSessionPanelUrl("example-session"),
    )!;
    manager.open(conversation, "main", navigate);
    expect(navigate).toHaveBeenCalledWith(buildSessionPath("example-session"));
    const page = manager.resolve("nextclaw://page?path=%2Fskills")!;
    manager.pin(page);
    expect(usePageNavigationStore.getState().pinned[0].uri).toBe(page.uri);
    manager.unpin(page.uri);
    expect(usePageNavigationStore.getState().pinned).toEqual([]);
  });
  it("uses the same chat reference from resource menus and preserves current conversation context", () => {
    const { manager, app, navigate } = setup();
    const page = manager.resolve("nextclaw://panel-app/example-notes")!;
    manager.addToChat(page, buildSessionPath("example-session"), navigate);
    expect(
      app.chatComposerIntentManager.requestUiResourceReference,
    ).toHaveBeenCalledWith({
      targetSessionKey: "example-session",
      reference: expect.objectContaining({ uri: page.uri }),
    });
    expect(navigate).not.toHaveBeenCalled();
  });
  it("adds resolved object snapshots to chat without sending or substituting a generic UI reference", async () => {
    const { manager, app, navigate } = setup();
    const page = manager.resolve("nextclaw://objects/cron-job/existing")!;
    const reference = {
      uri: page.uri,
      objectType: "cron-job",
      objectId: "existing",
      assetUri: "ncp://assets/exact-snapshot",
    };
    const resolve = vi
      .spyOn(nextclawClient.systemObjectReferences, "resolve")
      .mockResolvedValue(reference as never);
    try {
      manager.addToChat(page, "/cron", navigate);
      await Promise.resolve();
      await Promise.resolve();
      expect(resolve).toHaveBeenCalledWith(page.uri);
      expect(
        app.chatComposerIntentManager.requestSystemObjectReference,
      ).toHaveBeenCalledWith({ targetSessionKey: null, reference });
      expect(
        app.chatComposerIntentManager.requestUiResourceReference,
      ).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith("/chat");
    } finally {
      resolve.mockRestore();
    }
  });
  it("rejects unsafe schemes, unknown internal resources and off-origin route escapes", () => {
    const { manager } = setup();
    for (const uri of [
      "javascript:alert(1)",
      "data:text/html,x",
      "nextclaw://missing",
      "nextclaw://page?path=%2F%2Fevil.test",
      "nextclaw://page?path=%2Fresource",
    ]) {
      expect(manager.resolve(uri)).toBeNull();
    }
  });
});
