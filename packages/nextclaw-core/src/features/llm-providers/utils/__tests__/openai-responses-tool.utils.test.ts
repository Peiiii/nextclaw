import { describe, expect, it } from "vitest";
import { toOpenAiResponsesTools } from "@core/features/llm-providers/utils/openai-responses-tool.utils.js";

describe("toOpenAiResponsesTools", () => {
  it("converts internal function tools to the Responses API schema", () => {
    expect(toOpenAiResponsesTools([{
      type: "function",
      function: {
        name: "read_status",
        description: "Read system status",
        parameters: { type: "object", properties: { verbose: { type: "boolean" } } }
      }
    }])).toEqual([{
      type: "function",
      name: "read_status",
      description: "Read system status",
      parameters: { type: "object", properties: { verbose: { type: "boolean" } } },
      strict: null
    }]);
  });

  it("rejects malformed internal function tools before sending the request", () => {
    expect(() => toOpenAiResponsesTools([{ type: "function" }])).toThrow(
      "Invalid function tool at index 0: missing function definition."
    );
  });
});
