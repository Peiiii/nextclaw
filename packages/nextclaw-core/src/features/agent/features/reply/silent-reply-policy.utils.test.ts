import { describe, expect, it } from "vitest";
import { evaluateSilentReply } from "./silent-reply-policy.utils.js";

describe("silent reply policy", () => {
  it("drops only a standalone silent marker", () => {
    expect(evaluateSilentReply({ content: "\n<noreply/>\n" })).toMatchObject({
      shouldDrop: true,
      reason: "silent",
    });
    expect(evaluateSilentReply({
      content: "Empty runs return `<noreply/>`, while normal replies remain visible.",
    })).toEqual({
      content: "Empty runs return `<noreply/>`, while normal replies remain visible.",
      shouldDrop: false,
    });
  });
});
