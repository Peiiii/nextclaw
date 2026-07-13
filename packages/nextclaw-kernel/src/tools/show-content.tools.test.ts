import { describe, expect, it } from "vitest";
import { EventBus, eventKeys } from "@nextclaw/shared";
import type { NcpTool } from "@nextclaw/ncp";
import { createShowContentTools } from "./show-content.tools.js";
import { ShowContentToolProvider } from "@kernel/contributions/tool-provider/index.js";

type TestToolParameters = {
  required?: unknown;
  properties: Record<string, unknown>;
  additionalProperties?: unknown;
};

function getTool(name: string, eventBus = new EventBus()): NcpTool {
  const tool = createShowContentTools(eventBus).find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing test tool: ${name}`);
  }
  return tool;
}

function readParameters(tool: NcpTool): TestToolParameters {
  return tool.parameters as TestToolParameters;
}

describe("show content tools", () => {
  it("exposes narrow tools instead of the legacy show_content tool", () => {
    const tools = new ShowContentToolProvider(new EventBus()).provide().map((tool) => tool.name);

    expect(tools).toEqual(["show_file", "show_url", "show_panel_app"]);
    expect(tools).not.toContain("show_content");
  });

  it("advertises concrete top-level fields instead of an open payload object", () => {
    const fileTool = getTool("show_file");
    const urlTool = getTool("show_url");
    const panelAppTool = getTool("show_panel_app");
    const fileParameters = readParameters(fileTool);
    const urlParameters = readParameters(urlTool);
    const panelAppParameters = readParameters(panelAppTool);

    expect(fileTool.name).toBe("show_file");
    expect(fileParameters.required).toEqual(["path"]);
    expect(fileParameters.properties).toHaveProperty("path");
    expect(fileParameters.properties).toHaveProperty("viewer");
    expect(fileParameters.properties).not.toHaveProperty("payload");
    expect(fileParameters.properties).not.toHaveProperty("placement");
    expect(fileParameters.additionalProperties).toBe(false);

    expect(urlTool.name).toBe("show_url");
    expect(urlParameters.required).toEqual(["url"]);
    expect(urlParameters.properties).toHaveProperty("url");
    expect(urlParameters.properties).not.toHaveProperty("payload");
    expect(urlParameters.properties).not.toHaveProperty("placement");
    expect(urlParameters.additionalProperties).toBe(false);

    expect(panelAppTool.name).toBe("show_panel_app");
    expect(panelAppTool.description).toContain("tool-driven preview");
    expect(panelAppTool.description).toContain("side-panel only");
    expect(panelAppTool.description).toContain("do not call this tool");
    expect(panelAppTool.description).toContain("nextclaw-inline");
    expect(panelAppParameters.required).toEqual(["appId"]);
    expect(panelAppParameters.properties).toHaveProperty("appId");
    expect(panelAppParameters.properties).not.toHaveProperty("payload");
    expect(panelAppParameters.properties).not.toHaveProperty("placement");
    expect(panelAppParameters.additionalProperties).toBe(false);
  });

  it("returns a normalized showContent request for a file target", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });
    const result = await getTool("show_file", eventBus).execute({
      path: "README.md",
      title: "README",
      purpose: "read",
      line: 3,
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
            viewer: "auto",
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
            viewer: "auto",
          },
        },
        title: "README",
        purpose: "read",
        placement: "side_panel",
      },
    ]);
  });

  it("keeps a rendered file viewer request in the emitted event", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });

    const result = await getTool("show_file", eventBus).execute({
      path: "preview.html",
      viewer: "rendered",
      title: "HTML Preview",
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

  it("opens panel app showContent requests in the side panel", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });

    const result = await getTool("show_panel_app", eventBus).execute({
      appId: "reader",
      title: "Reader",
      purpose: "interact",
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
        placement: "side_panel",
      },
    ]);
  });

  it("rejects a URL target outside http and https", async () => {
    const eventBus = new EventBus();
    await expect(
      getTool("show_url", eventBus).execute({
        url: "file:///tmp/example.md",
      }),
    ).rejects.toThrow("url must use http or https.");
  });

  it("rejects unsupported file viewer values", async () => {
    const eventBus = new EventBus();
    await expect(
      getTool("show_file", eventBus).execute({
        path: "preview.html",
        viewer: "iframe",
      }),
    ).rejects.toThrow('viewer must be "auto", "source", "rendered".');
  });
});
