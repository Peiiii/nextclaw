import { describe, expect, it } from "vitest";
import { EventBus, eventKeys } from "@nextclaw/shared";
import { ShowContentTool } from "./show-content.tools.js";

describe("ShowContentTool", () => {
  it("returns a normalized showContent request for a file target", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });
    const result = await new ShowContentTool(eventBus).execute({
      type: "file",
      title: "README",
      purpose: "read",
      payload: {
        path: "README.md",
        line: 3,
      },
    }, {
      toolCallId: "call-show-content-1",
    });

    expect(result).toEqual({
      ok: true,
      action: "showContent",
      request: {
        target: {
          type: "file",
          payload: {
            path: "README.md",
            line: 3,
            column: undefined,
          },
        },
        title: "README",
        purpose: "read",
      },
    });
    expect(events).toEqual([
      {
        id: "tool:call-show-content-1:show-content",
        toolCallId: "call-show-content-1",
        target: {
          type: "file",
          payload: {
            path: "README.md",
            line: 3,
            column: undefined,
          },
        },
        title: "README",
        purpose: "read",
      },
    ]);
  });

  it("rejects a URL target outside http and https", async () => {
    const eventBus = new EventBus();
    await expect(
      new ShowContentTool(eventBus).execute({
        type: "url",
        payload: {
          url: "file:///tmp/example.md",
        },
      }),
    ).rejects.toThrow("payload.url must use http or https.");
  });
});
