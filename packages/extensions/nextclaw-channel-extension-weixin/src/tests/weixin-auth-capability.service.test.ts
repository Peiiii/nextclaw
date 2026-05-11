import { describe, expect, it, vi } from "vitest";
import type { ExtensionChannel } from "@nextclaw/extension-sdk";
import { WeixinAuthCapability } from "../services/weixin-auth-capability.service.js";

function createChannel(config: Record<string, unknown>): ExtensionChannel {
  return {
    id: "weixin",
    config: {
      get: vi.fn(async () => config),
      onChange: vi.fn(() => vi.fn()),
    },
    submitMessage: vi.fn(async () => undefined),
    onNcpEvent: vi.fn(() => vi.fn()),
  };
}

describe("WeixinAuthCapability", () => {
  it("maps standard channel auth requests to the weixin login service", async () => {
    const channel = createChannel({ enabled: true, baseUrl: "https://configured.example" });
    const loginService = {
      start: vi.fn(async () => ({ sessionId: "session-1" })),
      poll: vi.fn(async () => ({ status: "authorized" })),
      login: vi.fn(async () => ({ accountId: "account-1" })),
    };
    const capability = new WeixinAuthCapability({
      channel,
      loginService,
    });

    await capability.start({
      accountId: "account-1",
      baseUrl: "https://override.example",
    });
    await capability.poll({ sessionId: "session-1" });
    await capability.login({
      accountId: null,
      baseUrl: null,
      verbose: true,
    });

    expect(loginService.start).toHaveBeenCalledWith({
      pluginConfig: { enabled: true, baseUrl: "https://configured.example" },
      requestedAccountId: "account-1",
      baseUrl: "https://override.example",
    });
    expect(loginService.poll).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(loginService.login).toHaveBeenCalledWith({
      pluginConfig: { enabled: true, baseUrl: "https://configured.example" },
      requestedAccountId: null,
      baseUrl: null,
      verbose: true,
    });
  });
});
