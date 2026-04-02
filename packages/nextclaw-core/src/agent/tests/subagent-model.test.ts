import { describe, expect, it } from "vitest";
import { resolveSubagentModel } from "./subagent-model.js";

describe("resolveSubagentModel", () => {
  it("prioritizes explicit spawn model", () => {
    const resolved = resolveSubagentModel({
      spawnModel: "anthropic/claude-sonnet-4-5",
      sessionModel: "openai/gpt-5",
      runtimeDefaultModel: "dashscope/qwen3.5-flash",
      providerDefaultModel: "openai/gpt-5-mini"
    });
    expect(resolved).toBe("anthropic/claude-sonnet-4-5");
  });

  it("falls back to session model when spawn model is absent", () => {
    const resolved = resolveSubagentModel({
      sessionModel: "openai/gpt-5",
      runtimeDefaultModel: "dashscope/qwen3.5-flash",
      providerDefaultModel: "openai/gpt-5-mini"
    });
    expect(resolved).toBe("openai/gpt-5");
  });

  it("falls back through runtime and provider defaults", () => {
    expect(
      resolveSubagentModel({
        runtimeDefaultModel: "dashscope/qwen3.5-flash",
        providerDefaultModel: "openai/gpt-5-mini"
      })
    ).toBe("dashscope/qwen3.5-flash");

    expect(
      resolveSubagentModel({
        runtimeDefaultModel: "   ",
        providerDefaultModel: "openai/gpt-5-mini"
      })
    ).toBe("openai/gpt-5-mini");
  });
});
