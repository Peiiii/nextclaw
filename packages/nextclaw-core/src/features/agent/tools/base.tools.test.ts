import { describe, expect, it } from "vitest";
import { Tool } from "./base.tools.js";

class StrictTool extends Tool {
  get name(): string {
    return "strict_tool";
  }

  get description(): string {
    return "Strict test tool";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        mode: { type: "string" },
      },
      additionalProperties: false,
    };
  }

  execute = async (): Promise<unknown> => undefined;
}

describe("Tool", () => {
  it("rejects unsupported object properties when schema is strict", () => {
    expect(new StrictTool().validateParams({
      mode: "ok",
      request: { notify: "none" },
    })).toEqual(["request is not supported"]);
  });

  it("keeps permissive object schemas permissive by default", () => {
    const tool = new class extends StrictTool {
      override get parameters(): Record<string, unknown> {
        return {
          type: "object",
          properties: {
            mode: { type: "string" },
          },
        };
      }
    }();

    expect(tool.validateParams({
      mode: "ok",
      extra: true,
    })).toEqual([]);
  });
});
