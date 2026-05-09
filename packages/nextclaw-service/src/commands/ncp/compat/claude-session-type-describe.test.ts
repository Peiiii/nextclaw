import { describe, expect, it, vi } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import {
  createDescribeClaudeSessionType,
} from "../../../../../extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/index.js";

describe("Claude session type describe", () => {
  it("keeps observation mode side-effect-free and only probes in explicit probe mode", async () => {
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: "/tmp/nextclaw-claude-session-type-describe",
          model: "anthropic/claude-sonnet-4-5",
        },
      },
    });
    const probeCapability = vi.fn(async () => ({
      ready: false,
      reason: "authentication_failed",
      reasonMessage: "probe reached external capability detection",
      supportedModels: ["anthropic/claude-sonnet-4-5"],
      recommendedModel: "anthropic/claude-sonnet-4-5",
      discoverySource: "sdk" as const,
    }));

    const describeSessionType = createDescribeClaudeSessionType({
      config,
      pluginConfig: {
        apiKey: "test-claude-api-key",
        capabilityProbe: true,
        capabilityCacheTtlMs: 30_000,
      },
      probeCapability,
    });

    const observed = await describeSessionType({ describeMode: "observation" });
    expect(observed).toMatchObject({
      ready: true,
      reason: null,
      reasonMessage: null,
      recommendedModel: "anthropic/claude-sonnet-4-5",
    });
    expect(probeCapability).not.toHaveBeenCalled();

    const probed = await describeSessionType({ describeMode: "probe" });
    expect(probeCapability).toHaveBeenCalledTimes(1);
    expect(probed).toMatchObject({
      ready: false,
      reason: "authentication_failed",
      reasonMessage: "probe reached external capability detection",
    });
  });
});
