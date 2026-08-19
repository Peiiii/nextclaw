import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { PanelAppStateStore } from "./panel-app-state.store.js";

const STATE_FILE_NAME = ".panel-apps.state.json";
let tempDir: string | null = null;

async function createStore(): Promise<PanelAppStateStore> {
  tempDir = await mkdtemp(join(tmpdir(), "nextclaw-panel-app-state-"));
  return new PanelAppStateStore(tempDir);
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("PanelAppStateStore", () => {
  it("loads v1 state and migrates it without losing launcher preferences", async () => {
    const store = await createStore();
    await writeFile(join(tempDir!, STATE_FILE_NAME), JSON.stringify({
      version: 1,
      apps: { legacy: { favorite: true, openCount: 2 } },
    }));

    await expect(store.load()).resolves.toEqual({
      apps: { legacy: { favorite: true, openCount: 2 } },
      mainSidebarAppIds: [],
    });

    await store.updatePreferences("legacy", "example.legacy", { mainSidebar: true });
    const persisted = JSON.parse(await readFile(join(tempDir!, STATE_FILE_NAME), "utf8")) as {
      version: number;
      apps: Record<string, unknown>;
      mainSidebarAppIds: string[];
    };
    expect(persisted).toEqual({
      version: 2,
      apps: { legacy: { favorite: true, openCount: 2 } },
      mainSidebarAppIds: ["example.legacy"],
    });
  });

  it("normalizes malformed and duplicate main sidebar ids", async () => {
    const store = await createStore();
    await writeFile(join(tempDir!, STATE_FILE_NAME), JSON.stringify({
      version: 2,
      apps: {},
      mainSidebarAppIds: [" app.one ", "", "app.one", 42, "app.two"],
    }));

    await expect(store.load()).resolves.toEqual({
      apps: {},
      mainSidebarAppIds: ["app.one", "app.two"],
    });
  });

  it("adds and removes sidebar bindings idempotently while preserving order", async () => {
    const store = await createStore();

    await store.updatePreferences("one", "app.one", { mainSidebar: true });
    await store.updatePreferences("two", "app.two", { mainSidebar: true });
    await store.updatePreferences("one", "app.one", { mainSidebar: true });
    await expect(store.load()).resolves.toMatchObject({
      mainSidebarAppIds: ["app.one", "app.two"],
    });

    await store.updatePreferences("one", "app.one", { mainSidebar: false });
    await store.updatePreferences("one", "app.one", { mainSidebar: false });
    await expect(store.load()).resolves.toMatchObject({
      mainSidebarAppIds: ["app.two"],
    });
  });

  it("preserves sidebar bindings when recording opens and removes them on explicit delete", async () => {
    const store = await createStore();
    await store.updatePreferences("demo", "app.demo", {
      favorite: true,
      mainSidebar: true,
    });

    await expect(store.recordOpened("demo", new Date("2026-08-19T00:00:00.000Z"))).resolves.toEqual({
      entry: {
        favorite: true,
        lastOpenedAt: "2026-08-19T00:00:00.000Z",
        openCount: 1,
      },
      mainSidebarAppIds: ["app.demo"],
    });

    await store.deleteEntry("demo", "app.demo");
    await expect(store.load()).resolves.toEqual({ apps: {}, mainSidebarAppIds: [] });
  });
});
