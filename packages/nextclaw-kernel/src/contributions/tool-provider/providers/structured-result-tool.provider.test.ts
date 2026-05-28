import { describe, expect, it } from "vitest";
import { StructuredResultToolProvider } from "./structured-result-tool.provider.js";
import { STRUCTURED_RESULT_TOOL_NAME } from "@kernel/tools/structured-result.tools.js";

describe("StructuredResultToolProvider", () => {
  it("provides the structured result tool from message metadata", async () => {
    const provider = new StructuredResultToolProvider();

    const tools = await provider.provide({
      message: {
        metadata: {
          structured_result: {
            request_id: "request-1",
            schema: {
              type: "object",
              properties: { answer: { type: "number" } },
              required: ["answer"],
            },
            tool_name: STRUCTURED_RESULT_TOOL_NAME,
          },
        },
        parts: [],
        role: "user",
      },
    });

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe(STRUCTURED_RESULT_TOOL_NAME);
    await expect(tools[0]?.execute?.({ answer: 42 })).resolves.toEqual({ answer: 42 });
    expect(tools[0]?.validateArgs?.({})).toContain("answer is required");
  });

  it("ignores unrelated metadata", () => {
    const provider = new StructuredResultToolProvider();

    expect(provider.provide({
      message: {
        metadata: {},
        parts: [],
        role: "user",
      },
    })).toEqual([]);
  });
});
