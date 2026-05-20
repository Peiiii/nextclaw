import { describe, expect, it } from "vitest";
import { resolveExternalModelProvider } from "@/codex-model-provider.js";

describe("resolveExternalModelProvider", () => {
  it("prefers explicit model provider", () => {
    expect(resolveExternalModelProvider({
      explicitModelProvider: "nextclaw-codex-bridge-custom-2",
      providerName: "custom-2",
      providerDisplayName: "ai02",
      runtimeEntryId: "codex",
    })).toBe("nextclaw-codex-bridge-custom-2");
  });

  it("falls back to provider name", () => {
    expect(resolveExternalModelProvider({
      providerName: "custom-2",
      providerDisplayName: "ai02",
      runtimeEntryId: "codex",
    })).toBe("custom-2");
  });

  it("falls back to valid display name", () => {
    expect(resolveExternalModelProvider({
      providerDisplayName: "ai02",
      runtimeEntryId: "codex",
    })).toBe("ai02");
  });
});
