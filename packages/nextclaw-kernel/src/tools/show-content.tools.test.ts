import { describe, expect, it } from "vitest";
import { EventBus, eventKeys } from "@nextclaw/shared";
import { ShowContentTool } from "./show-content.tools.js";

describe("ShowContentTool", () => {
  it("advertises when panel apps should be shown inline", () => {
    const tool = new ShowContentTool(new EventBus());

    expect(tool.description).toContain('placement="inline"');
    expect(tool.description).toContain("interactive chat card");
    expect(tool.description).toContain('placement="side_panel"');
    expect(tool.description).toContain('payload.viewer="rendered"');
    expect(tool.description).toContain('payload.viewer="source"');
    expect(tool.description).toContain("Choose the placement yourself");
    expect(tool.description).toContain("without waiting for the user");
    expect(tool.parameters.properties.placement.description).toContain("chat card");
    expect(tool.parameters.properties.payload.description).toContain("viewer");
  });

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
            viewer: undefined,
          },
        },
        title: "README",
        purpose: "read",
        placement: undefined,
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
            viewer: undefined,
          },
        },
        title: "README",
        purpose: "read",
        placement: undefined,
      },
    ]);
  });

  it("keeps a rendered file viewer request in the emitted event", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });

    const result = await new ShowContentTool(eventBus).execute({
      type: "file",
      title: "HTML Preview",
      placement: "side_panel",
      payload: {
        path: "preview.html",
        viewer: "rendered",
      },
    });

    expect(result).toMatchObject({
      request: {
        target: {
          type: "file",
          payload: {
            path: "preview.html",
            viewer: "rendered",
          },
        },
        placement: "side_panel",
      },
    });
    expect(events).toEqual([
      expect.objectContaining({
        target: {
          type: "file",
          payload: {
            path: "preview.html",
            line: undefined,
            column: undefined,
            viewer: "rendered",
          },
        },
        placement: "side_panel",
      }),
    ]);
  });

  it("keeps inline placement on panel app showContent requests", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });

    const result = await new ShowContentTool(eventBus).execute({
      type: "panel_app",
      title: "Reader",
      purpose: "interact",
      placement: "inline",
      payload: {
        appId: "reader",
      },
    });

    expect(result).toEqual({
      ok: true,
      action: "showContent",
      request: {
        target: {
          type: "panel_app",
          payload: {
            appId: "reader",
          },
        },
        title: "Reader",
        purpose: "interact",
        placement: "inline",
      },
    });
    expect(events).toEqual([
      {
        id: "show-content:panel_app:reader",
        toolCallId: undefined,
        target: {
          type: "panel_app",
          payload: {
            appId: "reader",
          },
        },
        title: "Reader",
        purpose: "interact",
        placement: "inline",
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

  it("rejects unsupported placement values", async () => {
    const eventBus = new EventBus();
    await expect(
      new ShowContentTool(eventBus).execute({
        type: "panel_app",
        placement: "auto",
        payload: {
          appId: "weather-card",
        },
      }),
    ).rejects.toThrow('placement must be "inline" or "side_panel".');
  });

  it("rejects unsupported file viewer values", async () => {
    const eventBus = new EventBus();
    await expect(
      new ShowContentTool(eventBus).execute({
        type: "file",
        payload: {
          path: "preview.html",
          viewer: "iframe",
        },
      }),
    ).rejects.toThrow('payload.viewer must be "auto", "source", or "rendered".');
  });
});
