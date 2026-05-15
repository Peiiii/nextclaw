import { describe, expect, it, vi } from "vitest";
import { FeishuRegistrationService } from "../services/feishu-registration.service.js";
import type { FeishuAccountStore, StoredFeishuAccount } from "../stores/feishu-account.store.js";

class MemoryFeishuAccountStore implements FeishuAccountStore {
  readonly accounts = new Map<string, StoredFeishuAccount>();

  readonly listAccountIds = (): string[] => [...this.accounts.keys()];

  readonly loadAccount = (accountId: string): StoredFeishuAccount | null =>
    this.accounts.get(accountId) ?? null;

  readonly saveAccount = (account: StoredFeishuAccount): void => {
    this.accounts.set(account.accountId, account);
  };
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("FeishuRegistrationService", () => {
  it("creates a QR registration session and saves authorized app credentials", async () => {
    const store = new MemoryFeishuAccountStore();
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/oauth/v1/app/registration")) {
        const body = new URLSearchParams(String(init?.body ?? ""));
        const action = body.get("action");
        if (action === "init") {
          return jsonResponse({ supported_auth_methods: ["client_secret"] });
        }
        if (action === "begin") {
          return jsonResponse({
            device_code: "device-1",
            verification_uri_complete: "https://accounts.feishu.cn/qr",
            interval: 1,
            expire_in: 600,
          });
        }
        if (action === "poll") {
          return jsonResponse({
            client_id: "cli_a",
            client_secret: "secret-a",
            user_info: {
              open_id: "ou_owner",
              tenant_brand: "feishu",
            },
          });
        }
      }
      if (url.includes("/tenant_access_token/internal")) {
        return jsonResponse({ tenant_access_token: "tenant-token" });
      }
      if (url.includes("/bot/v3/info")) {
        return jsonResponse({
          bot: {
            app_name: "NextClaw Bot",
            open_id: "ou_bot",
          },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const service = new FeishuRegistrationService({ store, fetchImpl });

    const started = await service.start({
      pluginConfig: { enabled: false, allowFrom: ["ou_existing"] },
      requestedAccountId: "primary",
      domain: "feishu",
    });
    const authorized = await service.poll({ sessionId: started.sessionId });

    expect(started.qrCodeUrl).toContain("from=nextclaw");
    expect(authorized?.status).toBe("authorized");
    expect(authorized?.accountId).toBe("primary");
    expect(authorized?.pluginConfig).toMatchObject({
      enabled: true,
      defaultAccountId: "primary",
      accounts: {
        primary: {
          enabled: true,
          domain: "feishu",
          name: "NextClaw Bot",
          allowFrom: ["ou_existing", "ou_owner"],
        },
      },
    });
    expect(store.loadAccount("primary")).toMatchObject({
      appId: "cli_a",
      appSecret: "secret-a",
      botOpenId: "ou_bot",
      ownerOpenId: "ou_owner",
    });
  });

  it("returns pending when Feishu registration is not authorized yet", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = new URLSearchParams(String(init?.body ?? ""));
      if (url.includes("/oauth/v1/app/registration") && body.get("action") === "init") {
        return jsonResponse({ supported_auth_methods: ["client_secret"] });
      }
      if (url.includes("/oauth/v1/app/registration") && body.get("action") === "begin") {
        return jsonResponse({
          device_code: "device-1",
          verification_uri_complete: "https://accounts.feishu.cn/qr",
        });
      }
      if (url.includes("/oauth/v1/app/registration") && body.get("action") === "poll") {
        return jsonResponse({ error: "authorization_pending" }, { status: 400 });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;
    const service = new FeishuRegistrationService({
      store: new MemoryFeishuAccountStore(),
      fetchImpl,
    });

    const started = await service.start({});
    const result = await service.poll({ sessionId: started.sessionId });

    expect(result).toMatchObject({
      channel: "feishu",
      status: "pending",
      nextPollMs: 5_000,
    });
  });
});
