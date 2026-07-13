import {
  normalizeToolParams,
  type ToolExecutionContext,
} from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import {
  eventKeys,
  type EventBus,
  type UiShowContentEventPayload,
  type UiShowContentFileViewer,
  type UiShowContentPurpose,
  type UiShowContentTarget,
} from "@nextclaw/shared";

type ShowContentRequest = {
  target: UiShowContentTarget;
  title: string | undefined;
  purpose: UiShowContentPurpose | undefined;
};

type ShowContentEventBus = Pick<EventBus, "emit">;
type ShowContentToolSpec = {
  name: string;
  description: string;
  parameters: NcpTool["parameters"];
  normalize: (args: unknown) => ShowContentRequest;
};

const FILE_PURPOSES: readonly UiShowContentPurpose[] = ["read", "preview", "edit"];
const URL_PURPOSES: readonly UiShowContentPurpose[] = ["read", "preview"];
const PANEL_APP_PURPOSES: readonly UiShowContentPurpose[] = ["preview", "interact"];
const FILE_VIEWERS: readonly UiShowContentFileViewer[] = ["auto", "source", "rendered"];

function readRequiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim() || undefined;
}

function readOptionalPositiveInteger(value: unknown, key: string): number | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function readOptionalEnum<T extends string>(
  value: unknown,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const normalized = readOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  if ((allowed as readonly string[]).includes(normalized)) {
    return normalized as T;
  }
  const expected = allowed.map((item) => `"${item}"`).join(", ");
  throw new Error(`${key} must be ${expected}.`);
}

function readUrl(value: unknown): string {
  const url = readRequiredString(value, "url");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("url must be a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must use http or https.");
  }
  return parsed.toString();
}

function readCommonRequestFields(
  params: Record<string, unknown>,
  allowedPurposes: readonly UiShowContentPurpose[],
): Pick<ShowContentRequest, "title" | "purpose"> {
  return {
    title: readOptionalString(params.title),
    purpose: readOptionalEnum(params.purpose, "purpose", allowedPurposes),
  };
}

function normalizeShowFileArgs(args: unknown): ShowContentRequest {
  const params = normalizeToolParams(args);
  return {
    target: {
      type: "file",
      payload: {
        path: readRequiredString(params.path, "path"),
        line: readOptionalPositiveInteger(params.line, "line"),
        column: readOptionalPositiveInteger(params.column, "column"),
        viewer: readOptionalEnum(params.viewer, "viewer", FILE_VIEWERS) ?? "auto",
      },
    },
    ...readCommonRequestFields(params, FILE_PURPOSES),
  };
}

function normalizeShowUrlArgs(args: unknown): ShowContentRequest {
  const params = normalizeToolParams(args);
  return {
    target: {
      type: "url",
      payload: {
        url: readUrl(params.url),
      },
    },
    ...readCommonRequestFields(params, URL_PURPOSES),
  };
}

function normalizeShowPanelAppArgs(args: unknown): ShowContentRequest {
  const params = normalizeToolParams(args);
  return {
    target: {
      type: "panel_app",
      payload: {
        appId: readRequiredString(params.appId, "appId"),
      },
    },
    ...readCommonRequestFields(params, PANEL_APP_PURPOSES),
  };
}

function summarizeTarget(target: UiShowContentTarget): string {
  if (target.type === "file") {
    return target.payload.path;
  }
  if (target.type === "url") {
    return target.payload.url;
  }
  return target.payload.appId;
}

function createShowContentEventPayload(
  request: ShowContentRequest,
  context: ToolExecutionContext | undefined,
): UiShowContentEventPayload {
  const toolCallId = readOptionalString(context?.toolCallId);
  return {
    id: toolCallId
      ? `tool:${toolCallId}:show-content`
      : `show-content:${request.target.type}:${summarizeTarget(request.target)}`,
    toolCallId,
    target: request.target,
    title: request.title,
    purpose: request.purpose,
    placement: "side_panel",
  };
}

class ShowContentDisplayTool implements NcpTool {
  constructor(
    private readonly eventBus: ShowContentEventBus,
    private readonly spec: ShowContentToolSpec,
  ) {}

  get name(): string { return this.spec.name; }
  get description(): string { return this.spec.description; }
  get parameters(): NcpTool["parameters"] { return this.spec.parameters; }

  execute = async (args: unknown, context?: ToolExecutionContext): Promise<unknown> => {
    const request = this.spec.normalize(args);
    this.eventBus.emit(
      eventKeys.uiShowContent,
      createShowContentEventPayload(request, context),
      { source: "kernel" },
    );
    return { ok: true, action: "showContent", request };
  };
}

const SHOW_CONTENT_TOOL_SPECS: readonly ShowContentToolSpec[] = [
  {
    name: "show_file",
    description: 'Show a local file in the current chat UI. The automatic viewer displays images (including SVG), PDF, media, and supported documents, while text remains source. Use viewer="rendered" for HTML/page previews or viewer="source" to force source text.',
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Local file path to show." },
        title: { type: "string", description: "Optional title for the shown content." },
        purpose: { type: "string", enum: FILE_PURPOSES, description: "Optional user intent." },
        line: { type: "integer", minimum: 1, description: "Optional 1-based line number." },
        column: { type: "integer", minimum: 1, description: "Optional 1-based column number." },
        viewer: { type: "string", enum: FILE_VIEWERS, description: "Optional file viewer mode." },
      },
      required: ["path"],
      additionalProperties: false,
    },
    normalize: normalizeShowFileArgs,
  },
  {
    name: "show_url",
    description: "Show an http or https URL in the current chat UI browser. Use this for local development servers such as Vite, Next.js, Storybook, or any running web app URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "HTTP or HTTPS URL to show." },
        title: { type: "string", description: "Optional title for the shown content." },
        purpose: { type: "string", enum: URL_PURPOSES, description: "Optional user intent." },
      },
      required: ["url"],
      additionalProperties: false,
    },
    normalize: normalizeShowUrlArgs,
  },
  {
    name: "show_panel_app",
    description: 'Open a Panel App in the current chat UI as an immediate tool-driven preview. This tool is side-panel only. For inline Panel App display in a final reply, do not call this tool; output a Markdown nextclaw-inline fenced JSON block instead.',
    parameters: {
      type: "object",
      properties: {
        appId: { type: "string", description: "Installed Panel App id to show." },
        title: { type: "string", description: "Optional title for the shown content." },
        purpose: { type: "string", enum: PANEL_APP_PURPOSES, description: "Optional user intent." },
      },
      required: ["appId"],
      additionalProperties: false,
    },
    normalize: normalizeShowPanelAppArgs,
  },
];

export function createShowContentTools(eventBus: ShowContentEventBus): readonly NcpTool[] {
  return SHOW_CONTENT_TOOL_SPECS.map((spec) => new ShowContentDisplayTool(eventBus, spec));
}
