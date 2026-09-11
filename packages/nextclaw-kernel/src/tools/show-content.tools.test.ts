import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EventBus, eventKeys } from "@nextclaw/shared";
import type { NcpTool } from "@nextclaw/ncp";
import { createShowContentTools } from "./show-content.tools.js";
import { ShowContentToolProvider } from "@kernel/contributions/tool-provider/index.js";
import { PanelAppError } from "@kernel/types/panel-app.types.js";

type TestToolParameters = {
  required?: unknown;
  properties: Record<string, unknown>;
  additionalProperties?: unknown;
};

function getTool(
  name: string,
  eventBus = new EventBus(),
  resolvePanelAppDisplayTarget?: (id: string) => Promise<string | undefined>,
): NcpTool {
  const tool = createShowContentTools(eventBus, resolvePanelAppDisplayTarget)
    .find((candidate) => candidate.name === name);
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
    const tools = new ShowContentToolProvider(new EventBus(), {
      resolvePanelAppDisplayTarget: async () => {
        throw new Error("not used");
      },
    }).provide().map((tool) => tool.name);

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
    expect(fileParameters.properties).toHaveProperty("params");
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
    expect(panelAppParameters.properties).toHaveProperty("path");
    expect(panelAppParameters.properties).toHaveProperty("params");
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
      params: {
        series: [3, 5, 8],
      },
    });

    expect(result).toMatchObject({
      request: {
        target: {
          type: "file",
          payload: {
            path: "preview.html",
            viewer: "rendered",
            params: {
              series: [3, 5, 8],
            },
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
            params: {
              series: [3, 5, 8],
            },
          },
        },
        placement: "side_panel",
      }),
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

  it("rejects params for source and non-HTML file previews", async () => {
    await expect(
      getTool("show_file").execute({
        path: "preview.html",
        viewer: "source",
        params: { series: [3, 5, 8] },
      }),
    ).rejects.toThrow("params are supported only for rendered HTML file previews.");
    await expect(
      getTool("show_file").execute({
        path: "preview.json",
        viewer: "rendered",
        params: { series: [3, 5, 8] },
      }),
    ).rejects.toThrow("params are supported only for rendered HTML file previews.");
  });
});

describe("show_panel_app", () => {
  it("returns a canonical ordinary-link URI preserving encoded identity and source path", async () => {
    const result = await getTool("show_panel_app").execute({ appId: "reader notes", path: "/tmp/My panel.panel.html" });
    expect(result).toMatchObject({ resourceUri: "nextclaw://panel-app/reader%20notes?path=%2Ftmp%2FMy+panel.panel.html" });
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
      params: {
        file: { path: "/tmp/photo.png" },
      },
    });

    expect(result).toEqual({
      ok: true,
      action: "showContent",
      resourceUri: "nextclaw://panel-app/reader",
      request: {
        target: {
          type: "panel_app",
          payload: {
            appId: "reader",
            path: undefined,
            params: {
              file: { path: "/tmp/photo.png" },
            },
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
            path: undefined,
            params: {
              file: { path: "/tmp/photo.png" },
            },
          },
        },
        title: "Reader",
        purpose: "interact",
        placement: "side_panel",
      },
    ]);
  });

  it("resolves an installed App id to its primary Panel component before emitting", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });

    const result = await getTool(
      "show_panel_app",
      eventBus,
      async (id) => id === "publisher.demo-package" ? "stable-panel" : undefined,
    ).execute({
      appId: "publisher.demo-package",
      title: "Demo",
    });

    expect(result).toMatchObject({
      ok: true,
      resourceUri: "nextclaw://panel-app/stable-panel",
      request: {
        target: {
          type: "panel_app",
          payload: { appId: "stable-panel" },
        },
      },
    });
    expect(events).toEqual([
      expect.objectContaining({
        id: "show-content:panel_app:stable-panel",
        target: expect.objectContaining({
          payload: expect.objectContaining({ appId: "stable-panel" }),
        }),
      }),
    ]);
  });

  it("returns a structured error without emitting when the target does not exist", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });

    const result = await getTool(
      "show_panel_app",
      eventBus,
      async () => undefined,
    ).execute({ appId: "missing-app" });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PANEL_APP_NOT_FOUND",
        message: "panel app not found",
      },
    });
    expect(events).toEqual([]);
  });

  it("maps the production Panel target resolver's not-found error without emitting", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });
    const tool = new ShowContentToolProvider(eventBus, {
      resolvePanelAppDisplayTarget: async () => {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      },
    }).provide().find((candidate) => candidate.name === "show_panel_app");

    await expect(tool?.execute({ appId: "missing-app" })).resolves.toMatchObject({
      ok: false,
      error: { code: "PANEL_APP_NOT_FOUND" },
    });
    expect(events).toEqual([]);
  });

  it("opens a panel app from an explicit absolute source path", async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    const path = resolve("external", "reader.panel");
    eventBus.on(eventKeys.uiShowContent, (payload) => {
      events.push(payload);
    });

    const result = await getTool("show_panel_app", eventBus, async () => {
      throw new Error("explicit paths must bypass installed target resolution");
    }).execute({
      appId: "reader",
      path,
    });

    expect(result).toMatchObject({
      request: {
        target: {
          type: "panel_app",
          payload: {
            appId: "reader",
            path,
          },
        },
      },
    });
    expect(events).toEqual([
      expect.objectContaining({
        target: {
          type: "panel_app",
          payload: {
            appId: "reader",
            path,
          },
        },
      }),
    ]);
  });

  it("rejects a relative panel app source path", async () => {
    await expect(
      getTool("show_panel_app").execute({
        appId: "reader",
        path: "external/reader.panel",
      }),
    ).rejects.toThrow("path must be an absolute path.");
  });
});
