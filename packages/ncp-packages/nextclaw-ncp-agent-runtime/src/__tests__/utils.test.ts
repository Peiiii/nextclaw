import { describe, expect, it } from "vitest";
import { ToolResultContentManager } from "../tool-result-content.manager.js";
import { appendToolRoundToInput, validateToolArgs } from "../utils.js";

describe("validateToolArgs", () => {
  it("validates a flat object schema with additionalProperties false", () => {
    const schema = {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
      additionalProperties: false,
    };

    expect(validateToolArgs({ path: "/tmp/a.txt" }, schema)).toEqual([]);
    expect(validateToolArgs({ file_path: "/tmp/a.txt" }, schema)).toContain(
      "file_path is not allowed",
    );
    expect(validateToolArgs({}, schema)).toContain("path is required");
  });

  it("returns no issues when no schema is provided", () => {
    expect(validateToolArgs({ anything: true }, undefined)).toEqual([]);
  });
});

describe("tool result budget handling", () => {
  it("keeps oversized string tool results out of the next model input", () => {
    const contentManager = new ToolResultContentManager({ maxModelVisibleChars: 500 });
    const input = appendToolRoundToInput(
      { messages: [], model: "test-model" },
      "",
      "",
      [
        {
          toolCallId: "call-1",
          toolName: "large_output",
          args: {},
          rawArgsText: "{}",
          result: "a".repeat(5_000),
        },
      ],
      contentManager,
    );

    const toolMessage = input.messages.find((message) => message.role === "tool");
    expect(toolMessage?.content.length).toBeLessThanOrEqual(500);
    expect(toolMessage?.content).toContain("NextClaw tool result truncated");
    expect(toolMessage?.content).toContain("tool=large_output");
  });

  it("redacts screenshot-like base64 payloads before persisting tool results", () => {
    const contentManager = new ToolResultContentManager({ maxModelVisibleChars: 800 });
    const normalized = contentManager.normalizeToolCallResult({
      toolCallId: "call-screenshot",
      toolName: "mcp_chrome_devtools__take_screenshot",
      args: {},
      rawArgsText: "{}",
      result: {
        content: [
          {
            type: "image",
            mimeType: "image/png",
            data: "a".repeat(25_000),
          },
        ],
      },
    });

    const serialized = JSON.stringify(normalized.result);
    expect(serialized.length).toBeLessThan(800);
    expect(serialized).toContain('"type":"image"');
    expect(serialized).toContain('"mimeType":"image/png"');
    expect(serialized).toContain('"dataOmitted":true');
    expect(serialized).toContain('"originalDataChars":25000');
    expect(serialized).toContain("_nextclawToolResultNotice");
    expect(normalized.contentItems).toContainEqual(
      expect.objectContaining({
        type: "input_image",
        imageUrl: expect.stringMatching(/^data:image\/png;base64,/),
        originalDataChars: 25_000,
      }),
    );
  });

  it("compacts older tool messages when active tool context keeps growing", () => {
    const contentManager = new ToolResultContentManager({
      maxModelVisibleChars: 500,
      maxToolMessagesChars: 900,
    });
    const firstInput = appendToolRoundToInput(
      { messages: [], model: "test-model" },
      "",
      "",
      [buildToolResult("call-1", "first")],
      contentManager,
    );
    const secondInput = appendToolRoundToInput(
      firstInput,
      "",
      "",
      [buildToolResult("call-2", "second")],
      contentManager,
    );

    const toolContents = secondInput.messages
      .filter((message) => message.role === "tool")
      .map((message) => message.content);
    expect(toolContents.join("\n").length).toBeLessThan(1_000);
    expect(toolContents[0]).toContain("older tool result omitted");
    expect(toolContents[1]).toContain("tool=second");
  });

  it("adds visual observation messages when tool results contain images", () => {
    const contentManager = new ToolResultContentManager({ maxModelVisibleChars: 800 });
    const normalized = contentManager.normalizeToolCallResult({
      toolCallId: "call-image",
      toolName: "screenshot",
      args: {},
      rawArgsText: "{}",
      result: {
        content: [{ type: "image", mimeType: "image/png", data: "a".repeat(20) }],
      },
    });
    const input = appendToolRoundToInput(
      { messages: [], model: "test-model" },
      "",
      "",
      [normalized],
      contentManager,
    );

    const visualMessage = input.messages.find(
      (message) => message.role === "user" && Array.isArray(message.content),
    );
    expect(visualMessage?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text" }),
        expect.objectContaining({
          type: "image_url",
          image_url: expect.objectContaining({
            url: "data:image/png;base64,aaaaaaaaaaaaaaaaaaaa",
          }),
        }),
      ]),
    );
  });
});

function buildToolResult(toolCallId: string, label: string) {
  return {
    toolCallId,
    toolName: label,
    args: {},
    rawArgsText: "{}",
    result: `${label}:${"x".repeat(5_000)}`,
  };
}
