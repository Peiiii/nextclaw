import { describe, expect, it } from "vitest";
import { ConfigSchema } from "./schema.js";

describe("remote config schema", () => {
  it("provides disabled remote defaults", () => {
    const config = ConfigSchema.parse({});

    expect(config.remote).toEqual({
      enabled: false,
      deviceName: "",
      platformApiBase: "",
      autoReconnect: true
    });
  });

  it("preserves explicit remote settings", () => {
    const config = ConfigSchema.parse({
      remote: {
        enabled: true,
        deviceName: "My Workstation",
        platformApiBase: "https://ai-gateway-api.nextclaw.io/v1",
        autoReconnect: false
      }
    });

    expect(config.remote.enabled).toBe(true);
    expect(config.remote.deviceName).toBe("My Workstation");
    expect(config.remote.platformApiBase).toBe("https://ai-gateway-api.nextclaw.io/v1");
    expect(config.remote.autoReconnect).toBe(false);
  });
});
