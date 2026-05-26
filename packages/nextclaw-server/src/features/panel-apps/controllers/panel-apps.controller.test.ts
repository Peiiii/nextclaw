import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { PanelAppError } from "@nextclaw/kernel";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import type { UiKernelHost } from "@nextclaw-server/app/types/router-options.types.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-panel-apps-route-test-"));
  tempDirs.push(dir);
  const configPath = join(dir, "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  return configPath;
}

function createTestApp(panelAppManager: UiKernelHost["panelAppManager"]) {
  return createUiRouter({
    configPath: createTempConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({ panelAppManager }),
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("panel apps routes", () => {
  it("lists panel apps through the thin server route", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "/tmp/workspace",
        panelsPath: "/tmp/workspace/panels",
        entries: [{
          id: "demo",
          fileName: "demo.panel.html",
          title: "demo",
          contentPath: "/api/panel-apps/demo/content",
          updatedAt: "2026-05-26T00:00:00.000Z",
          sizeBytes: 12,
        }],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
    } as never);

    const response = await app.request("http://localhost/api/panel-apps");
    const payload = await response.json() as {
      ok: true;
      data: { entries: Array<{ fileName: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.entries[0]?.fileName).toBe("demo.panel.html");
  });

  it("serves panel app HTML content without wrapping it as JSON", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => ({
        id: "demo",
        fileName: "demo.panel.html",
        html: "<!doctype html><h1>Demo</h1>",
        contentType: "text/html; charset=utf-8" as const,
      }),
    } as never);

    const response = await app.request("http://localhost/api/panel-apps/demo/content");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("<!doctype html><h1>Demo</h1>");
  });

  it("maps panel app manager errors to route errors", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      },
    } as never);

    const response = await app.request("http://localhost/api/panel-apps/missing/content");
    const payload = await response.json() as { ok: false; error: { code: string } };

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("PANEL_APP_NOT_FOUND");
  });
});
