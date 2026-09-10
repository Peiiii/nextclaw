import { beforeEach, expect, it } from "vitest";
import { WorkbenchSurfaceManager } from "@/shared/components/workbench/managers/workbench-surface.manager";
import { useWorkbenchSurfaceStore } from "@/shared/components/workbench/stores/workbench-surface.store";
import { resizeWorkbenchRect } from "@/shared/components/workbench/utils/workbench-surface-geometry.utils";

const manager = new WorkbenchSurfaceManager();
beforeEach(() => useWorkbenchSurfaceStore.setState({ surfaces: {} }));

it("keeps geometry and placement through maximize, collapse and restore", () => {
  manager.place("file", "floating");
  manager.move("file", manager.get("file").rect, 100, 20, {
    width: 1400,
    height: 1000,
  });
  const { rect } = manager.get("file");
  manager.toggleMaximize("file");
  expect(manager.get("file")).toMatchObject({
    maximized: true,
    placement: "floating",
    rect,
  });
  manager.toggleMaximize("file");
  manager.minimize("file");
  manager.restore("file");
  expect(manager.get("file")).toMatchObject({
    minimized: false,
    maximized: false,
    rect,
  });
  manager.place("file", "docked");
  manager.place("file", "floating");
  expect(manager.get("file").rect).toEqual(rect);
});

it("isolates scopes, orders focused windows and constrains after viewport shrink", () => {
  manager.place("global", "floating");
  manager.place("session", "floating");
  manager.focus("global");
  expect(manager.get("global").layer).toBeGreaterThan(
    manager.get("session").layer,
  );
  manager.minimize("global");
  expect(manager.get("session").minimized).toBe(false);
  manager.constrain("global", { width: 280, height: 200 });
  const { rect } = manager.get("global");
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.w).toBeLessThanOrEqual(280);
  expect(rect.y + rect.h).toBeLessThanOrEqual(200);
});

it("anchors the opposite edge when resizing from left or top", () => {
  const rect = { x: 100, y: 100, w: 560, h: 640 };
  const next = resizeWorkbenchRect(rect, "top-left", 30, 40, {
    width: 1400,
    height: 1000,
  });
  expect(next.x + next.w).toBe(rect.x + rect.w);
  expect(next.y + next.h).toBe(rect.y + rect.h);
});

it("reloads validated layout without reviving transient maximized or collapsed state", async () => {
  manager.place("global", "floating");
  manager.minimize("global");
  await useWorkbenchSurfaceStore.persist.rehydrate();
  expect(manager.get("global")).toMatchObject({
    placement: "floating",
    minimized: false,
    maximized: false,
  });
});
