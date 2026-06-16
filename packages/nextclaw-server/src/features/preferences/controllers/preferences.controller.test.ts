import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import type { PreferenceJsonValue } from "@nextclaw/kernel";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import type { UiKernelHost } from "@nextclaw-server/app/types/router-options.types.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-preferences-route-test-"));
  tempDirs.push(dir);
  const configPath = join(dir, "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  return configPath;
}

function createTestApp(preferenceManager: UiKernelHost["preferenceManager"]) {
  return createUiRouter({
    configPath: createTempConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({ preferenceManager }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("preferences routes", () => {
  it("reads and updates preference values through the kernel manager", async () => {
    const setPreference = vi.fn(async (key: string, value: PreferenceJsonValue) => ({
      key,
      value,
      updatedAt: "2026-06-17T00:00:00.000Z",
    }));
    const app = createTestApp({
      getPreference: async () => null,
      setPreference,
      deletePreference: async () => false,
    } as never);

    const response = await app.request("http://localhost/api/preferences/chat.modelFavorites", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ value: ["openai/gpt-5.2"] }),
    });
    const payload = await response.json() as {
      ok: true;
      data: {
        key: string;
        value: string[];
        updatedAt: string;
      };
    };

    expect(response.status).toBe(200);
    expect(setPreference).toHaveBeenCalledWith("chat.modelFavorites", ["openai/gpt-5.2"]);
    expect(payload.data).toEqual({
      key: "chat.modelFavorites",
      value: ["openai/gpt-5.2"],
      updatedAt: "2026-06-17T00:00:00.000Z",
    });
  });

  it("returns null for missing preference values", async () => {
    const app = createTestApp({
      getPreference: async () => null,
      setPreference: async () => {
        throw new Error("not used");
      },
      deletePreference: async () => false,
    } as never);

    const response = await app.request("http://localhost/api/preferences/chat.modelFavorites");
    const payload = await response.json() as {
      ok: true;
      data: {
        key: string;
        value: null;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      key: "chat.modelFavorites",
      value: null,
    });
  });

  it("deletes preference values through the kernel manager", async () => {
    const deletePreference = vi.fn(async () => true);
    const app = createTestApp({
      getPreference: async () => null,
      setPreference: async () => {
        throw new Error("not used");
      },
      deletePreference,
    } as never);

    const response = await app.request("http://localhost/api/preferences/chat.modelFavorites", {
      method: "DELETE",
    });
    const payload = await response.json() as {
      ok: true;
      data: {
        key: string;
        deleted: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(deletePreference).toHaveBeenCalledWith("chat.modelFavorites");
    expect(payload.data).toEqual({
      key: "chat.modelFavorites",
      deleted: true,
    });
  });
});
