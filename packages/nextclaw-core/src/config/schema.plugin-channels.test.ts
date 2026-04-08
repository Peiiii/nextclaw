import { describe, expect, it } from "vitest";
import { ConfigSchema } from "./schema.js";

describe("ConfigSchema plugin channel compatibility", () => {
  it("keeps the default agent model empty until the user sets one", () => {
    const parsed = ConfigSchema.parse({});

    expect(parsed.agents.defaults.model).toBe("");
  });

  it("exposes weixin as a default builtin channel slot", () => {
    const parsed = ConfigSchema.parse({});

    expect(parsed.channels.weixin).toEqual({
      enabled: false
    });
  });

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
