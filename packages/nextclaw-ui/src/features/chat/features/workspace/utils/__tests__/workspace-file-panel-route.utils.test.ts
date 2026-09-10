import { expect, it } from "vitest";
import {
  createWorkspaceFilePanelTarget,
  readWorkspaceFilePanelView,
  resolveFileResourceTarget,
} from "@/features/chat/features/workspace/utils/workspace-file-panel-route.utils";
import { DocBrowserManager } from "@/shared/components/doc-browser/managers/doc-browser.manager";
import { WorkbenchSurfaceManager } from "@/shared/components/workbench/managers/workbench-surface.manager";
import { useDocBrowserStore } from "@/shared/components/doc-browser/stores/doc-browser.store";
import { RightPanelResourceRouteResolver } from "@/features/right-panel-resources";

it("carries source context and diff data through global open, dedupe and reload", async () => {
  const file = {
    key: "source::diff::src/a.ts",
    parentSessionKey: "source",
    path: "src/a.ts",
    viewMode: "diff" as const,
    fullLines: [
      { kind: "add" as const, text: "const result = 1;", newLineNumber: 1 },
    ],
  };
  const target = createWorkspaceFilePanelTarget(file, {
    workingDir: "/project/a",
    projectRoot: "/project",
  });
  const manager = new DocBrowserManager(
    new WorkbenchSurfaceManager(),
    new RightPanelResourceRouteResolver(),
  );
  manager.openTarget(target, { newTab: true, placement: "docked" });
  const before = useDocBrowserStore.getState().snapshot;
  manager.openTarget(target, { newTab: true });
  expect(useDocBrowserStore.getState().snapshot.tabs.length).toBe(
    before.tabs.length,
  );
  await useDocBrowserStore.persist.rehydrate();
  const state = useDocBrowserStore.getState().snapshot;
  const restored = readWorkspaceFilePanelView(
    state.tabs.find((tab) => tab.id === state.activeTabId)!,
  );
  expect(restored).toMatchObject({
    workingDir: "/project/a",
    projectRoot: "/project",
    file,
  });
  expect(target.url).not.toContain("const result");
});

it("resolves native file URIs using the source context and preserves precise location", () => {
  const target = resolveFileResourceTarget(
    "nextclaw://file/workspace/docs/readme.md?view=source&line=12&column=3",
    { workingDir: "/source-project", sessionKey: "source" },
  )!;
  expect(target.viewState).toMatchObject({
    workingDir: "/source-project",
    file: {
      path: "docs/readme.md",
      line: 12,
      column: 3,
      previewViewer: "source",
      parentSessionKey: "source",
    },
  });
  const restored = readWorkspaceFilePanelView({
    ...target,
    currentUrl: target.url,
  } as never);
  expect(restored?.file.line).toBe(12);
  expect(
    resolveFileResourceTarget("nextclaw://file/workspace/docs/a.md"),
  ).toBeNull();
  expect(
    resolveFileResourceTarget(
      "nextclaw://file/workspace/docs/a.md?base=%2Fexplicit",
      { workingDir: "/other" },
    )?.viewState,
  ).toMatchObject({ workingDir: "/explicit" });
  expect(
    resolveFileResourceTarget("nextclaw://file/absolute/tmp/a.md")?.viewState,
  ).toMatchObject({ workingDir: null, file: { path: "/tmp/a.md" } });
});

it("rejects traversal and malformed file scopes without changing resource identity", () => {
  for (const uri of [
    "nextclaw://file/unknown/a.md",
    "nextclaw://file/workspace/%2e%2e%2fprivate",
    "nextclaw://file/workspace/a%5Cb",
    "nextclaw://file/workspace/",
  ]) {
    expect(
      resolveFileResourceTarget(uri, { workingDir: "/source" }),
    ).toBeNull();
  }
});
