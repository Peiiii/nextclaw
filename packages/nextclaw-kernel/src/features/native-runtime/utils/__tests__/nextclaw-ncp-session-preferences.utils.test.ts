import { describe, expect, it } from "vitest";
import { resolveEffectiveModel } from "../nextclaw-ncp-session-preferences.utils.js";

describe("resolveEffectiveModel", () => {
  const defaultModel = "profile/default-model";

  it("falls back to profile model when no preferred_model is set", () => {
    const { model, fallbackModel } = resolveEffectiveModel({
      sessionMetadata: {},
      requestMetadata: {},
      fallbackModel: defaultModel,
    });
    expect(model).toBe(defaultModel);
    expect(fallbackModel).toBe(defaultModel);
  });

  it("uses preferred_model as the effective model when set", () => {
    const { model, fallbackModel } = resolveEffectiveModel({
      sessionMetadata: { preferred_model: "openai/gpt-5" },
      requestMetadata: {},
      fallbackModel: defaultModel,
    });
    expect(model).toBe("openai/gpt-5");
    expect(fallbackModel).toBe(defaultModel);
  });

  it("returns explicit fallback_model when set", () => {
    const { model, fallbackModel } = resolveEffectiveModel({
      sessionMetadata: {
        preferred_model: "openai/gpt-5",
        fallback_model: "anthropic/claude-3",
      },
      requestMetadata: {},
      fallbackModel: defaultModel,
    });
    expect(model).toBe("openai/gpt-5");
    expect(fallbackModel).toBe("anthropic/claude-3");
  });

  it("ignores undefined/null fallback_model and drops to profile", () => {
    const { model, fallbackModel } = resolveEffectiveModel({
      sessionMetadata: {
        preferred_model: "openai/gpt-5",
        fallback_model: null,
      },
      requestMetadata: {},
      fallbackModel: defaultModel,
    });
    expect(model).toBe("openai/gpt-5");
    expect(fallbackModel).toBe(defaultModel);
  });

  it("clears both preferred_model and fallback_model when clear_model is true", () => {
    const { model, fallbackModel } = resolveEffectiveModel({
      sessionMetadata: {
        preferred_model: "openai/gpt-5",
        fallback_model: "anthropic/claude-3",
      },
      requestMetadata: { clear_model: true },
      fallbackModel: defaultModel,
    });
    expect(model).toBe(defaultModel);
    expect(fallbackModel).toBe(defaultModel);
  });

  it("keeps explicit session fallback_model when inbound model overrides preferred", () => {
    const { model, fallbackModel } = resolveEffectiveModel({
      sessionMetadata: {
        preferred_model: "openai/gpt-4",
        fallback_model: "anthropic/claude-2",
      },
      requestMetadata: { model: "openai/gpt-5" },
      fallbackModel: defaultModel,
    });
    expect(model).toBe("openai/gpt-5");
    expect(fallbackModel).toBe("anthropic/claude-2");
  });
});
