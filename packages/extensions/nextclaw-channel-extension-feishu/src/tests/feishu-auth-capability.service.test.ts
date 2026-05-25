import { describe, expect, it, vi } from "vitest";
import type { ExtensionChannel } from "@nextclaw/extension-sdk";
import { FeishuAuthCapability } from "../services/feishu-auth-capability.service.js";

function createChannel(config: Record<string, unknown>): ExtensionChannel {
  return {
    id: "feishu",
    config: {
      get: vi.fn(async () => config),
      onChange: vi.fn(() => vi.fn()),
    },
    submitMessage: vi.fn(async () => undefined),
    onNcpEvent: vi.fn(() => vi.fn()),
  };
}

describe("FeishuAuthCapability", () => {
  it("maps standard channel auth requests to the registration service", async () => {
    const channel = createChannel({ enabled: true, domain: "feishu" });
    const registrationService = {
      start: vi.fn(async () => ({ sessionId: "session-1" })),
      poll: vi.fn(async () => ({ status: "authorized" })),
    };
    const capability = new FeishuAuthCapability({
      channel,
      registrationService,
    });

    await capability.start({
      accountId: "account-1",
      domain: "lark",
      verbose: true,
    });
    await capability.poll({ sessionId: "session-1" });

    expect(registrationService.start).toHaveBeenCalledWith({
      channelConfig: { enabled: true, domain: "feishu" },
      requestedAccountId: "account-1",
      domain: "lark",
      verbose: true,
    });
    expect(registrationService.poll).toHaveBeenCalledWith({ sessionId: "session-1" });
  });
});
