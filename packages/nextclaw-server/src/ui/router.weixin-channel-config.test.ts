import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, loadConfig, saveConfig } from "@nextclaw/core";
import type { PluginChannelBinding, PluginUiMetadata } from "@nextclaw/openclaw-compat";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-weixin-config-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
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
      baseUrl: { label: "API Base URL" },
      pollTimeoutMs: { label: "Long Poll Timeout (ms)", advanced: true },
      allowFrom: { label: "Allow From" }
    }
  };
}

describe("weixin plugin channel config route", () => {
  it("projects weixin into UI config meta, schema, and update flow", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const publish = vi.fn();

    const app = createUiRouter({
      configPath,
      publish,
      getPluginChannelBindings: () => [createWeixinPluginBinding()],
      getPluginUiMetadata: () => [createWeixinPluginUiMetadata()]
    });

    const metaResponse = await app.request("http://localhost/api/config/meta");
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

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);
    const configPayload = await configResponse.json() as {
      ok: true;
      data: {
        channels: Record<string, Record<string, unknown>>;
      };
    };
    expect(configPayload.data.channels.weixin).toEqual({ enabled: false });

    const schemaResponse = await app.request("http://localhost/api/config/schema");
    expect(schemaResponse.status).toBe(200);
    const schemaPayload = await schemaResponse.json() as {
      ok: true;
      data: {
        uiHints: Record<string, { label?: string; help?: string }>;
      };
    };
    expect(schemaPayload.data.uiHints["channels.weixin"]?.label).toBe("Weixin");
    expect(schemaPayload.data.uiHints["channels.weixin.baseUrl"]?.label).toBe("API Base URL");

    const updateResponse = await app.request("http://localhost/api/config/channels/weixin", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        enabled: true,
        defaultAccountId: "1344b2b24720@im.bot",
        baseUrl: "https://ilinkai.weixin.qq.com",
        pollTimeoutMs: 35000,
        allowFrom: ["o9cq804svxfyCCTIqzddDqRBeMC0@im.wechat"]
      })
    });

    expect(updateResponse.status).toBe(200);
    const updatePayload = await updateResponse.json() as {
      ok: true;
      data: Record<string, unknown>;
    };
    expect(updatePayload.data).toMatchObject({
      enabled: true,
      defaultAccountId: "1344b2b24720@im.bot",
      baseUrl: "https://ilinkai.weixin.qq.com",
      pollTimeoutMs: 35000
    });

    const saved = loadConfig(configPath);
    expect(saved.channels.weixin).toEqual({
      enabled: true,
      defaultAccountId: "1344b2b24720@im.bot",
      baseUrl: "https://ilinkai.weixin.qq.com",
      pollTimeoutMs: 35000,
      allowFrom: ["o9cq804svxfyCCTIqzddDqRBeMC0@im.wechat"]
    });
    expect(saved.plugins.entries?.["nextclaw-channel-weixin"]).toEqual({
      enabled: true
    });
    expect(publish).toHaveBeenCalledWith({
      type: "config.updated",
      payload: { path: "channels.weixin" }
    });
  });
});
