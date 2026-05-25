import { describe, expect, it, vi } from "vitest";
import { FeishuAccountConnectionService } from "../services/feishu-account-connection.service.js";
import type { FeishuAccountStore, StoredFeishuAccount } from "../stores/feishu-account.store.js";

class MemoryFeishuAccountStore implements FeishuAccountStore {
  readonly accounts = new Map<string, StoredFeishuAccount>();

  readonly listAccountIds = (): string[] => [...this.accounts.keys()];

  readonly loadAccount = (accountId: string): StoredFeishuAccount | null =>
    this.accounts.get(accountId) ?? null;

  readonly saveAccount = (account: StoredFeishuAccount): void => {
    this.accounts.set(account.accountId, account);
  };

  readonly deleteAccount = (accountId: string): void => {
    this.accounts.delete(accountId);
  };
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("FeishuAccountConnectionService", () => {
  it("connects an existing Feishu bot with app credentials", async () => {
    const store = new MemoryFeishuAccountStore();
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/tenant_access_token/internal")) {
        return jsonResponse({ tenant_access_token: "tenant-token" });
      }
      if (url.includes("/bot/v3/info")) {
        return jsonResponse({
          bot: {
            app_name: "Existing Agent",
            open_id: "ou_bot",
          },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const service = new FeishuAccountConnectionService({ store, fetchImpl });

    const result = await service.connect({
      channelConfig: { enabled: false },
      domain: "feishu",
      appId: "cli_existing",
      appSecret: "secret-existing",
    });

    expect(result.status).toBe("authorized");
    expect(result.accountId).toBe("cli_existing");
    expect(result.channelConfig).toMatchObject({
      enabled: true,
      defaultAccountId: "cli_existing",
      accounts: {
        cli_existing: {
          enabled: true,
          domain: "feishu",
          name: "Existing Agent",
        },
      },
    });
    expect(store.loadAccount("cli_existing")).toMatchObject({
      appId: "cli_existing",
      appSecret: "secret-existing",
      botName: "Existing Agent",
      botOpenId: "ou_bot",
    });
  });

  it("replaces the previous default agent when connecting a new existing app", async () => {
    const store = new MemoryFeishuAccountStore();
    store.saveAccount({
      accountId: "old-agent",
      appId: "cli_old",
      appSecret: "secret-old",
      domain: "feishu",
      botOpenId: "ou_old",
    });
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/tenant_access_token/internal")) {
        return jsonResponse({ tenant_access_token: "tenant-token" });
      }
      if (url.includes("/bot/v3/info")) {
        return jsonResponse({ bot: { app_name: "New Agent", open_id: "ou_new" } });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const service = new FeishuAccountConnectionService({ store, fetchImpl });

    const result = await service.connect({
      channelConfig: {
        enabled: true,
        defaultAccountId: "old-agent",
        accounts: {
          "old-agent": { enabled: true, domain: "feishu", name: "Old Agent" },
        },
      },
      domain: "feishu",
      appId: "new-agent",
      appSecret: "secret-new",
    });

    expect(result.channelConfig).toMatchObject({
      enabled: true,
      defaultAccountId: "new-agent",
      accounts: {
        "new-agent": { enabled: true, domain: "feishu", name: "New Agent" },
      },
    });
    expect((result.channelConfig.accounts as Record<string, unknown>)["old-agent"]).toBeUndefined();
    expect(store.loadAccount("old-agent")).toBeNull();
    expect(store.loadAccount("new-agent")).toMatchObject({
      appId: "new-agent",
      appSecret: "secret-new",
      botOpenId: "ou_new",
    });
    expect(result.notes).toContain("Replaced previous Feishu agent: old-agent");
  });

  it("does not save an account when credentials cannot be verified", async () => {
    const store = new MemoryFeishuAccountStore();
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ code: 999, msg: "invalid app secret" }, { status: 400 }),
    ) as unknown as typeof fetch;
    const service = new FeishuAccountConnectionService({ store, fetchImpl });

    await expect(service.connect({
      domain: "feishu",
      appId: "cli_existing",
      appSecret: "wrong-secret",
    })).rejects.toThrow("invalid app secret");
    expect(store.listAccountIds()).toEqual([]);
  });
});
