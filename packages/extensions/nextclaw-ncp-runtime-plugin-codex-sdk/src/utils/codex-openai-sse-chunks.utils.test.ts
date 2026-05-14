import { describe, expect, it } from "vitest";
import {
  extractContentText,
  extractReasoningText,
} from "./codex-openai-sse-chunks.utils.js";

describe("OpenAI SSE chunk extraction", () => {
  it("preserves leading spaces in reasoning deltas", () => {
    expect(extractReasoningText({ reasoning_content: " user" })).toBe(" user");
  });

  it("preserves leading spaces in array content text deltas", () => {
    expect(extractContentText([{ type: "text", text: " world" }])).toBe(" world");
  });
});
