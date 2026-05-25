import { describe, expect, it, vi } from "vitest";
import { WeixinLoginService } from "../services/weixin-login.service.js";
import type { WeixinApiClient } from "../services/weixin-api.service.js";
import type { StoredWeixinAccount, WeixinAccountStore } from "../stores/weixin-account.store.js";

describe("WeixinLoginService", () => {
  it("persists authorized account and returns channel config for the UI auth route", async () => {
    const store = new MemoryWeixinAccountStore();
    store.saveAccount({
      accountId: "old-bot@im.bot",
      token: "old-token",
      userId: "user-1@im.wechat",
    });
    const api = createLoginApi();
    const service = new WeixinLoginService({ api, store });

    const startResult = await service.start({
      channelConfig: {
        enabled: true,
        defaultAccountId: "old-bot@im.bot",
        accounts: {
          "old-bot@im.bot": {
            enabled: true,
            allowFrom: ["user-1@im.wechat"],
          },
        },
      },
    });
    const pollResult = await service.poll({ sessionId: startResult.sessionId });

    expect(startResult).toMatchObject({
      channel: "weixin",
      kind: "qr_code",
      qrCode: "qr-token",
      qrCodeUrl: "https://example.com/qr.png",
    });
    expect(pollResult).toMatchObject({
      channel: "weixin",
      status: "authorized",
      accountId: "bot-1@im.bot",
      channelConfig: {
        enabled: true,
        defaultAccountId: "bot-1@im.bot",
        accounts: {
          "bot-1@im.bot": {
            enabled: true,
            baseUrl: "https://ilinkai.weixin.qq.com",
            userId: "user-1@im.wechat",
            allowFrom: ["user-1@im.wechat"],
          },
        },
      },
    });
    expect(store.loadAccount("bot-1@im.bot")).toMatchObject({
      accountId: "bot-1@im.bot",
      token: "bot-token",
      baseUrl: "https://ilinkai.weixin.qq.com",
      userId: "user-1@im.wechat",
    });
    expect(store.loadAccount("old-bot@im.bot")).toBeNull();
    expect(api.fetchQrStatus).toHaveBeenCalledWith(expect.objectContaining({
      qrcode: "qr-token",
      timeoutMs: 5_000,
    }));
  });
});

class MemoryWeixinAccountStore implements WeixinAccountStore {
  private readonly accounts = new Map<string, StoredWeixinAccount>();
  private readonly cursors = new Map<string, string>();

  listAccountIds = (): string[] => [...this.accounts.keys()];

  loadAccount = (accountId: string): StoredWeixinAccount | null => this.accounts.get(accountId) ?? null;

  saveAccount = (account: StoredWeixinAccount): void => {
    this.accounts.set(account.accountId, account);
  };

  deleteAccount = (accountId: string): void => {
    this.accounts.delete(accountId);
  };

  loadCursor = (accountId: string): string | undefined => this.cursors.get(accountId);

  saveCursor = (accountId: string, cursor: string | undefined): void => {
    if (cursor === undefined) {
      this.cursors.delete(accountId);
      return;
    }
    this.cursors.set(accountId, cursor);
  };

  deleteCursor = (accountId: string): void => {
    this.cursors.delete(accountId);
  };
}

function createLoginApi(): WeixinApiClient {
  return {
    fetchQrCode: vi.fn(async () => ({
      qrcode: "qr-token",
      qrcode_img_content: "https://example.com/qr.png",
    })),
    fetchQrStatus: vi.fn(async () => ({
      status: "confirmed",
      bot_token: "bot-token",
      ilink_bot_id: "bot-1@im.bot",
      baseurl: "https://ilinkai.weixin.qq.com",
      ilink_user_id: "user-1@im.wechat",
    })),
    fetchUpdates: vi.fn(async () => ({ ret: 0, msgs: [] })),
    fetchConfig: vi.fn(async () => ({ ret: 0, typing_ticket: "typing-ticket" })),
    sendTyping: vi.fn(async () => ({ ret: 0 })),
    sendMessageItem: vi.fn(async () => ({ messageId: "message-1" })),
    sendTextMessage: vi.fn(async () => ({ messageId: "message-1" })),
  };
}
