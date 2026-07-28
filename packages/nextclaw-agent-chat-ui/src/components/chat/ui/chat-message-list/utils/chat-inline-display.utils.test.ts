import { describe, expect, it } from "vitest";
import { parseChatInlineDisplayDirective } from "./chat-inline-display.utils";

describe("nextclaw-inline content params", () => {
  it("preserves Panel App params", () => {
    expect(
      parseChatInlineDisplayDirective(
        JSON.stringify({
          target: {
            type: "panel_app",
            payload: {
              appId: "image-editor",
              params: { file: { path: "/tmp/photo.png" } },
            },
          },
        }),
      ),
    ).toMatchObject({
      target: {
        type: "panel_app",
        payload: {
          appId: "image-editor",
          params: { file: { path: "/tmp/photo.png" } },
        },
      },
    });
  });

  it("preserves params for rendered HTML", () => {
    expect(
      parseChatInlineDisplayDirective(
        JSON.stringify({
          target: {
            type: "file",
            payload: {
              path: "/tmp/chart.html",
              viewer: "rendered",
              params: { series: [3, 5, 8] },
            },
          },
        }),
      ),
    ).toMatchObject({
      target: {
        type: "file",
        payload: {
          path: "/tmp/chart.html",
          viewer: "rendered",
          params: { series: [3, 5, 8] },
        },
      },
    });
  });

  it.each([
    { path: "/tmp/chart.html", viewer: "source" },
    { path: "/tmp/chart.json", viewer: "rendered" },
  ])("rejects params for unsupported file targets", ({ path, viewer }) => {
    expect(
      parseChatInlineDisplayDirective(
        JSON.stringify({
          target: {
            type: "file",
            payload: {
              path,
              viewer,
              params: { series: [3, 5, 8] },
            },
          },
        }),
      ),
    ).toBeNull();
  });

  it("rejects non-object params", () => {
    expect(
      parseChatInlineDisplayDirective(
        JSON.stringify({
          target: {
            type: "panel_app",
            payload: {
              appId: "image-editor",
              params: ["not", "an", "object"],
            },
          },
        }),
      ),
    ).toBeNull();
  });

  it("rejects non-finite and oversized params", () => {
    expect(
      parseChatInlineDisplayDirective(
        '{"target":{"type":"panel_app","payload":{"appId":"chart","params":{"value":1e400}}}}',
      ),
    ).toBeNull();
    expect(
      parseChatInlineDisplayDirective(
        JSON.stringify({
          target: {
            type: "panel_app",
            payload: {
              appId: "chart",
              params: { value: "界".repeat(64 * 1024) },
            },
          },
        }),
      ),
    ).toBeNull();
  });
});
