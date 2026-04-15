import { describe, expect, it } from "vitest";
import { resolveClaudeExecutionProbeTimeoutMs } from "../../../../../../extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-shared.utils.js";

describe("Claude session type probe defaults", () => {
  it("uses a longer execution probe timeout by default so slow but working models stay visible", () => {
    expect(resolveClaudeExecutionProbeTimeoutMs(undefined)).toBe(30_000);
  });

  it("still honors explicit overrides while enforcing the minimum floor", () => {
    expect(resolveClaudeExecutionProbeTimeoutMs(45_000)).toBe(45_000);
    expect(resolveClaudeExecutionProbeTimeoutMs(200)).toBe(1_000);
  });
});
