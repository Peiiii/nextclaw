import { describe, expect, it } from "vitest";
import { ConfigSchema } from "./schema.js";

describe("ConfigSchema plugin channel compatibility", () => {
  it("preserves plugin-backed channel config under channels.*", () => {
    const parsed = ConfigSchema.parse({
      channels: {
        weixin: {
          enabled: true,
          baseUrl: "https://ilinkai.weixin.qq.com",
          defaultAccountId: "bot-1@im.bot"
        }
      }
    });

    expect(parsed.channels.weixin).toEqual({
      enabled: true,
      baseUrl: "https://ilinkai.weixin.qq.com",
      defaultAccountId: "bot-1@im.bot"
    });
  });
});
