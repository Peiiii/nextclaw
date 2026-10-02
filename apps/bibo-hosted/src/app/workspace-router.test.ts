import assert from "node:assert/strict";
import test from "node:test";
import { filePathHref, readWorkspaceRoute, resourceHref } from "@/app/workspace-router";

test("file routes accept complete paths after edge slash normalization and preserve reserved characters", () => {
  for (const view of ["notes", "files"] as const) {
    for (const id of ["笔记/功能演示 - 起步.md", "多级/子目录/含 % # ? 字符.md", "path/真实文件.md", "笔记/字面%2F.md"]) {
      const href = resourceHref(view, id);
      assert.equal(href.includes("%2F"), false, "directory separators remain canonical URL separators");
      assert.deepEqual(readWorkspaceRoute(href), { view, sessionId: null, resourceId: id, filePath: null, notFound: false });
      assert.equal(readWorkspaceRoute(`/${view}/${encodeURIComponent(id)}`).resourceId, id, "existing fully encoded URLs match before or after the edge redirect");
    }
    assert.equal(readWorkspaceRoute(`/${view}`).resourceId, null);
  }
  assert.equal(readWorkspaceRoute("/notes/%invalid").notFound, true, "malformed encoding never starts a resource request");
});

test("path lookups cannot shadow a real path directory and decode once", () => {
  const path = "/data/workspace/笔记/字面%2F # ?.md";
  const url = new URL(filePathHref(path), "https://app.bibo.bot");
  assert.equal(url.pathname, "/files");
  assert.deepEqual(readWorkspaceRoute(url.pathname, url.search), { view: "files", sessionId: null, resourceId: null, filePath: path, notFound: false });
  assert.equal(readWorkspaceRoute(resourceHref("files", "path/真实文件.md")).resourceId, "path/真实文件.md");
  assert.equal(readWorkspaceRoute(resourceHref("tasks", "task-a")).resourceId, "task-a");
  assert.equal(readWorkspaceRoute("/calendar/event-a").resourceId, "event-a");
  assert.equal(readWorkspaceRoute("/chat/session-a").sessionId, "session-a");
  assert.equal(readWorkspaceRoute("/unknown/path").notFound, true);
});
