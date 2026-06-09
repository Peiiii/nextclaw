import { describe, expect, it } from "vitest";
import { buildShowContentToolCard } from "./chat-message-show-content-tool-card.utils";

describe("buildShowContentToolCard", () => {
  it("builds a show-content action from a normalized show_content result", () => {
    const card = buildShowContentToolCard({
      invocation: {
        status: "result",
        toolCallId: "call-show-content",
        toolName: "show_content",
        result: {
          ok: true,
          action: "showContent",
          request: {
            target: {
              type: "file",
              payload: {
                path: "docs/example.md",
                line: 2,
              },
            },
            title: "Example",
            purpose: "read",
          },
        },
      },
      actionLabel: "Show content",
      statusLabel: "Completed",
    });

    expect(card).toMatchObject({
      kind: "result",
      name: "show_content",
      detail: "Example",
      statusTone: "success",
      statusLabel: "Completed",
      action: {
        kind: "show-content",
        label: "Show content",
        request: {
          target: {
            type: "file",
            payload: {
              path: "docs/example.md",
              line: 2,
            },
          },
          title: "Example",
          purpose: "read",
        },
      },
    });
  });
});
