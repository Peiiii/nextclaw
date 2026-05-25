import { describe, expect, it } from "vitest";
import { normalizeModelMessagesForVisionSupport } from "./model-message-vision.utils.js";

describe("normalizeModelMessagesForVisionSupport", () => {
  it("preserves image input for vision models", () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
          { type: "text", text: "describe it" },
        ],
      },
    ];

    expect(normalizeModelMessagesForVisionSupport({ messages, supportsVision: true })).toBe(messages);
  });

  it("turns image parts into text before non-vision provider calls", () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
          { type: "text", text: "hello" },
        ],
      },
      {
        role: "tool",
        content: [
          { type: "input_text", text: "screenshot" },
          { type: "input_image", image_url: "data:image/png;base64,def" },
        ],
      },
    ];

    const normalized = normalizeModelMessagesForVisionSupport({ messages, supportsVision: false });

    expect(normalized).toEqual([
      {
        role: "user",
        content: "[Image omitted: the selected model is not configured for vision input.]\n\nhello",
      },
      {
        role: "tool",
        content: [
          { type: "input_text", text: "screenshot" },
          { type: "text", text: "[Image omitted: the selected model is not configured for vision input.]" },
        ],
      },
    ]);
  });
});
