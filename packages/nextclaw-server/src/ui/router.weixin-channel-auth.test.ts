import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, loadConfig, saveConfig } from "@nextclaw/core";
import type { PluginChannelBinding } from "@nextclaw/openclaw-compat";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-weixin-auth-test-"));
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

function createWeixinPluginBinding() {
  const start = vi.fn(async () => ({
    channel: "weixin",
    kind: "qr_code" as const,
    sessionId: "weixin-session-1",
    qrCode: "qr-token",
    qrCodeUrl: "https://example.com/weixin-qr.png",
    expiresAt: "2026-03-23T10:00:00.000Z",
    intervalMs: 1500,
    note: "scan me"
  }));
  const poll = vi.fn(async () => ({
    channel: "weixin",
    status: "authorized" as const,
    message: "微信已连接。",
    nextPollMs: 0,
    accountId: "bot-1@im.bot",
    notes: ["Authorized initial user: user-1@im.wechat"],
    pluginConfig: {
      enabled: true,
      defaultAccountId: "bot-1@im.bot",
      baseUrl: "https://ilinkai.weixin.qq.com",
      accounts: {
        "bot-1@im.bot": {
          enabled: true
        }
      }
    }
  }));

  const binding: PluginChannelBinding = {
    pluginId: "nextclaw-channel-weixin",
    channelId: "weixin",
    channel: {
      id: "weixin",
      auth: {
        start,
        poll
      }
    }
  };

  return { binding, start, poll };
}

describe("weixin plugin channel auth route", () => {
  it("starts qr auth and persists authorized plugin config", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const publish = vi.fn();
    const { binding, start, poll } = createWeixinPluginBinding();

    const app = createUiRouter({
      configPath,
      publish,
      getPluginChannelBindings: () => [binding]
    });

    const startResponse = await app.request("http://localhost/api/config/channels/weixin/auth/start", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        baseUrl: "https://ilinkai.weixin.qq.com"
      })
    });

    expect(startResponse.status).toBe(200);
    expect(await startResponse.json()).toEqual({
      ok: true,
      data: {
        channel: "weixin",
        kind: "qr_code",
        sessionId: "weixin-session-1",
        qrCode: "qr-token",
        qrCodeUrl: "https://example.com/weixin-qr.png",
        expiresAt: "2026-03-23T10:00:00.000Z",
        intervalMs: 1500,
        note: "scan me"
      }
    });

    expect(start).toHaveBeenCalledTimes(1);

    const pollResponse = await app.request("http://localhost/api/config/channels/weixin/auth/poll", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId: "weixin-session-1"
      })
    });

    expect(pollResponse.status).toBe(200);
    expect(await pollResponse.json()).toEqual({
      ok: true,
      data: {
        channel: "weixin",
        status: "authorized",
        message: "微信已连接。",
        nextPollMs: 0,
        accountId: "bot-1@im.bot",
        notes: ["Authorized initial user: user-1@im.wechat"]
      }
    });

    expect(poll).toHaveBeenCalledTimes(1);
    expect(loadConfig(configPath).plugins.entries?.["nextclaw-channel-weixin"]).toEqual({
      enabled: true,
      config: {
        enabled: true,
        defaultAccountId: "bot-1@im.bot",
        baseUrl: "https://ilinkai.weixin.qq.com",
        accounts: {
          "bot-1@im.bot": {
            enabled: true
          }
        }
      }
    });
    expect(publish).toHaveBeenCalledWith({
      type: "config.updated",
      payload: { path: "channels.weixin" }
    });
  });
});
