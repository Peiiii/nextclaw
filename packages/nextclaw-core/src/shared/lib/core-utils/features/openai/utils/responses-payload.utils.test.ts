import { describe, expect, it } from "vitest";
import { parseOpenAiResponsesPayload } from "./responses-payload.utils.js";

describe("parseOpenAiResponsesPayload", () => {
  it("preserves a complete non-JSON provider response in the diagnostic error", () => {
    const responseText = `upstream failure ${"x".repeat(240)} END_OF_PROVIDER_ERROR`;

    expect(() => parseOpenAiResponsesPayload(responseText)).toThrow(
      `Responses API returned non-JSON payload: ${responseText}`,
    );
  });
});
