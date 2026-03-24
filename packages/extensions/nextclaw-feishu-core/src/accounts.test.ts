import { describe, expect, it } from "vitest";
import { getDefaultFeishuAccountId, getEnabledFeishuAccounts, resolveFeishuAccount } from "./accounts.js";
import { FeishuConfigSchema } from "./config-schema.js";

describe("feishu accounts", () => {
  it("merges top-level defaults with account overrides", () => {
    const config = FeishuConfigSchema.parse({
      enabled: true,
      appId: "base-app",
      appSecret: "base-secret",
      domain: "lark",
      requireMention: true,
      accounts: {
        ops: {
          appId: "ops-app",
          appSecret: "ops-secret",
          requireMention: false
        }
      }
    });

    const account = resolveFeishuAccount(config, "ops");
    expect(account.accountId).toBe("ops");
    expect(account.appId).toBe("ops-app");
    expect(account.appSecret).toBe("ops-secret");
    expect(account.brand).toBe("lark");
    expect(account.config.requireMention).toBe(false);
    expect(account.enabled).toBe(true);
  });

  it("uses the first account as default when account map exists", () => {
    const config = FeishuConfigSchema.parse({
      enabled: true,
      accounts: {
        team: {
          enabled: true,
          appId: "team-app",
          appSecret: "team-secret"
        }
      }
    });

    expect(getDefaultFeishuAccountId(config)).toBe("team");
    expect(resolveFeishuAccount(config).accountId).toBe("team");
  });

  it("filters enabled configured accounts", () => {
    const config = FeishuConfigSchema.parse({
      accounts: {
        enabledAccount: {
          enabled: true,
          appId: "app-1",
          appSecret: "secret-1"
        },
        disabledAccount: {
          enabled: false,
          appId: "app-2",
          appSecret: "secret-2"
        },
        incompleteAccount: {
          enabled: true,
          appId: "app-3"
        }
      }
    });

    expect(getEnabledFeishuAccounts(config).map((account) => account.accountId)).toEqual(["enabledAccount"]);
  });
});
