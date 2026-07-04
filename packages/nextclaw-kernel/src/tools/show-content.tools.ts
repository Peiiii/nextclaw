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
  type UiShowContentPlacement,
  type UiShowContentPurpose,
  type UiShowContentTarget,
} from "@nextclaw/shared";

export const SHOW_CONTENT_TOOL_NAME = "show_content";

type ShowContentRequest = {
  target: UiShowContentTarget;
  title: string | undefined;
  purpose: UiShowContentPurpose | undefined;
  placement: UiShowContentPlacement | undefined;
};

type ShowContentEventBus = Pick<EventBus, "emit">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

function readPurpose(value: unknown): UiShowContentPurpose | undefined {
  const normalized = readOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  if (
    normalized === "read" ||
    normalized === "preview" ||
    normalized === "edit" ||
    normalized === "interact"
  ) {
    return normalized;
  }
  throw new Error('purpose must be "read", "preview", "edit", or "interact".');
}

function readPlacement(value: unknown): UiShowContentPlacement | undefined {
  const normalized = readOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  if (normalized === "inline" || normalized === "side_panel") {
    return normalized;
  }
  throw new Error('placement must be "inline" or "side_panel".');
}

function readFileViewer(value: unknown): UiShowContentFileViewer | undefined {
  const normalized = readOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  if (normalized === "auto" || normalized === "source" || normalized === "rendered") {
    return normalized;
  }
  throw new Error('payload.viewer must be "auto", "source", or "rendered".');
}

function readPayload(params: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(params.payload)) {
    throw new Error("payload must be an object.");
  }
  return params.payload;
}

function readUrl(value: unknown): string {
  const url = readRequiredString(value, "payload.url");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("payload.url must be a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("payload.url must use http or https.");
  }
  return parsed.toString();
}

function normalizeShowContentArgs(args: unknown): ShowContentRequest {
  const params = normalizeToolParams(args);
  const type = readRequiredString(params.type, "type");
  const payload = readPayload(params);
  const title = readOptionalString(params.title);
  const purpose = readPurpose(params.purpose);
  const placement = readPlacement(params.placement);

  if (type === "file") {
    return {
      target: {
        type,
        payload: {
          path: readRequiredString(payload.path, "payload.path"),
          line: readOptionalPositiveInteger(payload.line, "payload.line"),
          column: readOptionalPositiveInteger(payload.column, "payload.column"),
          viewer: readFileViewer(payload.viewer),
        },
      },
      title,
      purpose,
      placement,
    };
  }

  if (type === "url") {
    return {
      target: {
        type,
        payload: {
          url: readUrl(payload.url),
        },
      },
      title,
      purpose,
      placement,
    };
  }

  if (type === "panel_app") {
    return {
      target: {
        type,
        payload: {
          appId: readRequiredString(payload.appId, "payload.appId"),
        },
      },
      title,
      purpose,
      placement,
    };
  }

  throw new Error('type must be "file", "url", or "panel_app".');
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
    placement: request.placement,
  };
}

export class ShowContentTool implements NcpTool {
  readonly name = SHOW_CONTENT_TOOL_NAME;
  readonly description = [
    "Show file, URL, or panel app content in the current chat UI.",
    'placement="inline" embeds a lightweight panel_app as an interactive chat card so the user can try it directly in the conversation.',
    'placement="side_panel" opens content in the right side panel for larger reading, editing, or sustained workflows.',
    'For file targets, use payload.viewer="rendered" when the user should see a rendered local HTML/page preview, payload.viewer="source" when the user should inspect source text, and omit it or use "auto" for the default source-style preview.',
    'Choose the placement yourself: after creating a lightweight Panel App such as a weather card, calculator, timer, checklist, picker, form, preview, or small dashboard, call this tool with placement="inline" without waiting for the user to ask to see it.',
    "Omit placement only when preserving the existing default side panel behavior is intentional.",
  ].join(" ");
  readonly parameters = {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["file", "url", "panel_app"],
        description: "Content target type.",
      },
      title: {
        type: "string",
        description: "Optional title for the shown content.",
      },
      purpose: {
        type: "string",
        enum: ["read", "preview", "edit", "interact"],
        description: "Optional user intent for the content.",
      },
      placement: {
        type: "string",
        enum: ["inline", "side_panel"],
        description: 'Optional display placement. "inline" embeds a lightweight panel app as an interactive chat card; "side_panel" opens it in the right panel for larger workflows. Choose the appropriate placement yourself; defaults to the existing side panel behavior when omitted.',
      },
      payload: {
        type: "object",
        description: "Type-specific fields: file={path,line,column,viewer}; url={url}; panel_app={appId}. File viewer may be auto, source, or rendered.",
        additionalProperties: true,
      },
    },
    required: ["type", "payload"],
    additionalProperties: false,
  };

  constructor(private readonly eventBus: ShowContentEventBus) {}

  execute = async (args: unknown, context?: ToolExecutionContext): Promise<unknown> => {
    const request = normalizeShowContentArgs(args);
    this.eventBus.emit(
      eventKeys.uiShowContent,
      createShowContentEventPayload(request, context),
      { source: "kernel" },
    );
    return {
      ok: true,
      action: "showContent",
      request,
    };
  };
}
