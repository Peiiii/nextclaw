import { describe, expect, it } from "vitest";
import { PartnershipContextProvider } from "./partnership-context.provider.js";

function makeManager(mode: string) {
  return {
    loadConfig: () => ({
      agents: {
        partnershipMode: mode as "off" | "observe" | "analyze" | "assist" | "execute",
      },
    }),
  } as never;
}

describe("PartnershipContextProvider", () => {
  it("returns empty block when mode is off", async () => {
    const provider = new PartnershipContextProvider(makeManager("off"));
    const blocks = await provider.provide();
    expect(blocks).toHaveLength(0);
  });

  it("returns empty block when mode is assist (default)", async () => {
    const provider = new PartnershipContextProvider(makeManager("assist"));
    const blocks = await provider.provide();
    expect(blocks).toHaveLength(0);
  });

  it("injects observe instructions", async () => {
    const provider = new PartnershipContextProvider(makeManager("observe"));
    const blocks = await provider.provide();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!).toContain("observation mode");
    expect(blocks[0]!).toContain("never act without explicit permission");
  });

  it("injects analyze instructions", async () => {
    const provider = new PartnershipContextProvider(makeManager("analyze"));
    const blocks = await provider.provide();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!).toContain("analysis mode");
    expect(blocks[0]!).toContain("DO NOT execute");
  });

  it("injects execute instructions", async () => {
    const provider = new PartnershipContextProvider(makeManager("execute"));
    const blocks = await provider.provide();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!).toContain("execution mode");
    expect(blocks[0]!).toContain("Safe, routine actions");
  });

  it("falls back to empty block for unknown mode", async () => {
    // @ts-expect-error testing unknown mode fallback
    const provider = new PartnershipContextProvider(makeManager("unknown-mode"));
    const blocks = await provider.provide();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBe("");
  });
});
