import { describe, expect, it } from "vitest";
import { ConfigSchema } from "./config-schema.config.js";

describe("product analytics config", () => {
  it("is private by default and accepts explicit audience segregation", () => {
    expect(ConfigSchema.parse({}).productAnalytics).toEqual({
      enabled: false,
      audience: "external",
    });
    expect(ConfigSchema.parse({
      productAnalytics: { enabled: true, audience: "qa" },
    }).productAnalytics).toEqual({ enabled: true, audience: "qa" });
  });
});
