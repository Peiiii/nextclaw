import {
  normalizeToolParams,
} from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";

export const SHOW_CONTENT_TOOL_NAME = "show_content";

type ShowContentPurpose = "read" | "preview" | "edit" | "interact";

type ShowContentTarget =
  | { type: "file"; payload: { path: string; line: number | undefined; column: number | undefined } }
  | { type: "url"; payload: { url: string } }
  | { type: "panel_app"; payload: { appId: string } };

type ShowContentRequest = {
  target: ShowContentTarget;
  title: string | undefined;
  purpose: ShowContentPurpose | undefined;
};

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

function readPurpose(value: unknown): ShowContentPurpose | undefined {
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

  if (type === "file") {
    return {
      target: {
        type,
        payload: {
          path: readRequiredString(payload.path, "payload.path"),
          line: readOptionalPositiveInteger(payload.line, "payload.line"),
          column: readOptionalPositiveInteger(payload.column, "payload.column"),
        },
      },
      title,
      purpose,
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
    };
  }

  throw new Error('type must be "file", "url", or "panel_app".');
}

export class ShowContentTool implements NcpTool {
  readonly name = SHOW_CONTENT_TOOL_NAME;
  readonly description = "Show file, URL, or panel app content in the current chat UI.";
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
      payload: {
        type: "object",
        description: "Type-specific fields: file={path,line,column}; url={url}; panel_app={appId}.",
        additionalProperties: true,
      },
    },
    required: ["type", "payload"],
    additionalProperties: false,
  };

  execute = async (args: unknown): Promise<unknown> => ({
    ok: true,
    action: "showContent",
    request: normalizeShowContentArgs(args),
  });
}
