import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { saveWeixinAccount } from "./weixin-account.store.js";
import { buildWeixinMessageToolHints } from "./index.js";

const tempHomes: string[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createHome(): string {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-weixin-hints-test-"));
  mkdirSync(home, { recursive: true });
  process.env.NEXTCLAW_HOME = home;
  tempHomes.push(home);
  return home;
}

afterEach(() => {
  if (originalNextclawHome) {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempHomes.length > 0) {
    const home = tempHomes.pop();
    if (!home) {
      continue;
    }
    rmSync(home, { recursive: true, force: true });
  }
});

describe("buildWeixinMessageToolHints", () => {
  it("includes the known self-notify route when exactly one authorized user is known", () => {
    createHome();
    saveWeixinAccount({
      accountId: "bot-1@im.bot",
      token: "token",
      userId: "user-1@im.wechat",
      baseUrl: "https://ilinkai.weixin.qq.com",
      savedAt: "2026-03-29T00:00:00.000Z",
    });
    const config = ConfigSchema.parse({
      channels: {
        weixin: {
          enabled: true,
          defaultAccountId: "bot-1@im.bot",
          accounts: {
            "bot-1@im.bot": {
              enabled: true,
              allowFrom: ["user-1@im.wechat"],
            },
          },
        },
      },
    });

    const hints = buildWeixinMessageToolHints({ cfg: config, accountId: null });

    expect(hints).toContain("Default Weixin accountId is 'bot-1@im.bot'.");
    expect(hints.some((hint) => hint.includes("Known Weixin self-notify route"))).toBe(true);
    expect(hints.some((hint) => hint.includes("to='user-1@im.wechat'"))).toBe(true);
  });
});
