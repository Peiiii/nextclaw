import { describe, expect, it } from "vitest";
import { ConfigSchema } from "./config-schema.config.js";

describe("learning loop config schema", () => {
  it("provides disabled learning loop defaults", () => {
    const config = ConfigSchema.parse({});

    expect(config.agents.learningLoop).toEqual({
      enabled: false,
      toolCallThreshold: 15,
    });
  });

  it("preserves explicit learning loop settings", () => {
    const config = ConfigSchema.parse({
      agents: {
        learningLoop: {
          enabled: false,
          toolCallThreshold: 7,
        },
      },
    });

    expect(config.agents.learningLoop).toEqual({
      enabled: false,
      toolCallThreshold: 7,
    });
  });
});
