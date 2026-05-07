import { describe, expect, it } from "vitest";
import { ConfigSchema } from "../../config/schema.js";
import { resolveThinkingLevel } from "../thinking/thinking.utils.js";

describe("resolveThinkingLevel", () => {
  it("prioritizes session override over config defaults", () => {
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          model: "openai/gpt-5.3-codex",
          thinkingDefault: "low"
        }
      }
    });

    const resolved = resolveThinkingLevel({
      config,
      agentId: "main",
      model: "openai/gpt-5.3-codex",
      sessionThinkingLevel: "high"
    });

    expect(resolved).toBe("high");
  });

  it("resolves in order: agent model > global model > agent default > global default > off", () => {
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          model: "openai/gpt-5.3-codex",
          thinkingDefault: "low",
          models: {
            "openai/gpt-5.3-codex": { params: { thinking: "medium" } }
          }
        },
        list: [
          {
            id: "main",
            thinkingDefault: "high",
            models: {
              "openai/gpt-5.3-codex": { params: { thinking: "minimal" } }
            }
          },
          {
            id: "assistant",
            thinkingDefault: "high"
          }
        ]
      }
    });

    expect(
      resolveThinkingLevel({
        config,
        agentId: "main",
        model: "openai/gpt-5.3-codex"
      })
    ).toBe("minimal");

    expect(
      resolveThinkingLevel({
        config,
        agentId: "assistant",
        model: "openai/gpt-5.3-codex"
      })
    ).toBe("medium");

    expect(
      resolveThinkingLevel({
        config,
        agentId: "assistant",
        model: "openai/gpt-4.1"
      })
    ).toBe("high");

    expect(
      resolveThinkingLevel({
        config,
        agentId: "unknown",
        model: "openai/gpt-4.1"
      })
    ).toBe("low");

    expect(
      resolveThinkingLevel({
        config: ConfigSchema.parse({})
      })
    ).toBe("off");
  });

  it("falls back to model thinking capability default/off when requested level is unsupported", () => {
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          model: "openai/gpt-5.3-codex",
          thinkingDefault: "high"
        }
      },
      providers: {
        openai: {
          apiKey: "sk-test",
          modelThinking: {
            "gpt-5.3-codex": {
              supported: ["minimal", "low"],
              default: "low"
            },
            "gpt-4.1": {
              supported: ["minimal", "low"]
            }
          }
        }
      }
    });

    expect(
      resolveThinkingLevel({
        config,
        model: "openai/gpt-5.3-codex",
        sessionThinkingLevel: "high"
      })
    ).toBe("low");

    expect(
      resolveThinkingLevel({
        config,
        model: "openai/gpt-4.1",
        sessionThinkingLevel: "high"
      })
    ).toBe("off");

    expect(
      resolveThinkingLevel({
        config,
        model: "openai/gpt-5.3-codex",
        sessionThinkingLevel: "off"
      })
    ).toBe("off");
  });
});
