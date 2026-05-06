import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import type { PluginChannelBinding, PluginUiMetadata } from "@nextclaw/openclaw-compat";
import { startUiServer } from "./server.js";

const tempDirs: string[] = [];

async function reservePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve test port.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForServer(baseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the listener is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for UI server: ${baseUrl}`);
}

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-server-weixin-channel-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

function createWeixinPluginBinding(): PluginChannelBinding {
  return {
    pluginId: "nextclaw-channel-weixin",
    channelId: "weixin",
    channel: {
      id: "weixin",
      meta: {
        label: "Weixin",
        selectionLabel: "Weixin",
        blurb: "Weixin QR login + getupdates long-poll channel"
      }
    }
  };
}

function createWeixinPluginUiMetadata(): PluginUiMetadata {
  return {
    id: "nextclaw-channel-weixin",
    configUiHints: {
      enabled: { label: "Enabled" },
      defaultAccountId: { label: "Default Account ID" },
      baseUrl: { label: "API Base URL" }
    }
  };
}

describe("ui server weixin plugin channel wiring", () => {
  const handles: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (handles.length > 0) {
      const handle = handles.pop();
      if (handle) {
        await handle.close();
      }
    }
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("exposes projected weixin channel through startUiServer", async () => {
    const port = await reservePort();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const handle = await startUiServer({
      host: "127.0.0.1",
      port,
      configPath,
      getPluginChannelBindings: () => [createWeixinPluginBinding()],
      getPluginUiMetadata: () => [createWeixinPluginUiMetadata()]
    });
    handles.push(handle);

    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(baseUrl);

    const metaResponse = await fetch(`${baseUrl}/api/config/meta`);
    expect(metaResponse.status).toBe(200);
    const metaPayload = await metaResponse.json() as {
      ok: true;
      data: {
        channels: Array<{ name: string; displayName?: string; enabled: boolean }>;
      };
    };
    expect(metaPayload.data.channels).toContainEqual(
      expect.objectContaining({
        name: "weixin",
        displayName: "Weixin",
        enabled: false
      })
    );

    const configResponse = await fetch(`${baseUrl}/api/config`);
    expect(configResponse.status).toBe(200);
    const configPayload = await configResponse.json() as {
      ok: true;
      data: {
        channels: Record<string, Record<string, unknown>>;
      };
    };
    expect(configPayload.data.channels.weixin).toEqual({ enabled: false });
  });
});
