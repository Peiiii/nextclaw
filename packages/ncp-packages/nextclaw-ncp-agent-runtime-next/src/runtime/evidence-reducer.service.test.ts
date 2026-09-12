import { describe, expect, it } from "vitest";
import type { NcpToolCallResult } from "@nextclaw/ncp";
import { EvidencePreservingReducer } from "./evidence-reducer.service.js";

const makeResult = (content: unknown): NcpToolCallResult => ({
  toolCallId: "c1",
  toolName: "echo",
  args: null,
  rawArgsText: "{}",
  result: content,
});

describe("EvidencePreservingReducer", () => {
  it("does not reduce small results", () => {
    const reducer = new EvidencePreservingReducer({ thresholdChars: 5000 });
    const result = reducer.reduceResult(makeResult("tiny"));
    expect(result.result).toBe("tiny");
  });

  it("wraps large results in review envelope", () => {
    const bigData = "x".repeat(10_000);
    const reducer = new EvidencePreservingReducer({ thresholdChars: 5000 });
    const result = reducer.reduceResult(makeResult(bigData));
    const r = result.result as Record<string, unknown>;
    expect(r._reducerReview).toBeDefined();
    expect(r._originalSize).toBeGreaterThan(5000);
    expect(r._verdict).toBeNull();
    expect(r._note).toBeNull();
  });

  it("returns unchanged when below threshold", () => {
    const reducer = new EvidencePreservingReducer({ thresholdChars: 5000 });
    const input = makeResult("small content");
    const result = reducer.reduceResult(input);
    expect(result.result).toBe("small content");
  });

  it("applies verdict to wrapped result", () => {
    const bigData = "y".repeat(6000);
    const reducer = new EvidencePreservingReducer({ thresholdChars: 5000 });
    let result = reducer.reduceResult(makeResult(bigData));
    const r = result.result as Record<string, unknown>;
    expect(r._reducerReview).toBeDefined();

    result = reducer.applyVerdict(result, "PASS", "Result is self-consistent");
    const wrapped = result.result as Record<string, unknown>;
    expect(wrapped._verdict).toBe("PASS");
    expect(wrapped._note).toContain("self-consistent");
  });

  it("skip injectSummary does not wrap", () => {
    const bigData = "z".repeat(10_000);
    const reducer = new EvidencePreservingReducer({
      thresholdChars: 5000,
      injectSummary: false,
    });
    const result = reducer.reduceResult(makeResult(bigData));
    expect(result.result).toBe(bigData);
  });
});
