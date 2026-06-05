import { describe, expect, it } from "vitest";

import { parseModelRoute } from "../src/utils/route.utils.js";

describe("parseModelRoute", () => {
  it("splits only the first slash", () => {
    expect(parseModelRoute("openrouter/vendor/model-id")).toEqual({
      providerId: "openrouter",
      providerLocalModel: "vendor/model-id"
    });
  });

  it("rejects invalid routes", () => {
    expect(() => parseModelRoute("missing-slash")).toThrow("Model route must use");
  });
});
