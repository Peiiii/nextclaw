import { describe, expect, it } from "vitest";
import { BUILTIN_CHANNEL_PLUGIN_IDS, isBuiltinChannelPluginId } from "@nextclaw/runtime";

describe("builtin channel surface", () => {
  it("includes weixin in the product builtin channel set", () => {
    expect(BUILTIN_CHANNEL_PLUGIN_IDS).toContain("weixin");
    expect(isBuiltinChannelPluginId("weixin")).toBe(true);
  });
});
