import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-router-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("marketplace manage plugin id resolution", () => {
  it("maps canonical plugin spec to builtin plugin id when disabling", async () => {
    const configPath = createTempConfigPath();
    saveConfig(
      ConfigSchema.parse({
        plugins: {
          entries: {
            "builtin-channel-discord": {
              enabled: true
            }
          }
        }
      }),
      configPath
    );

    const disablePlugin = vi.fn(async () => ({
      message: "Disabled plugin \"builtin-channel-discord\"."
    }));

    const app = createUiRouter({
      configPath,
      publish: () => {},
      marketplace: {
        installer: {
          disablePlugin
        }
      }
    });

    const response = await app.request("http://localhost/api/marketplace/manage", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "plugin",
        action: "disable",
        id: "@nextclaw/channel-plugin-discord",
        spec: "@nextclaw/channel-plugin-discord"
      })
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        id: string;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.id).toBe("builtin-channel-discord");
    expect(disablePlugin).toHaveBeenCalledTimes(1);
    expect(disablePlugin).toHaveBeenCalledWith("builtin-channel-discord");
  });
});
