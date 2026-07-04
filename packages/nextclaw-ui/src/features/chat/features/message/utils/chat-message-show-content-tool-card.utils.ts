import type {
  ChatUiShowContentRequest,
} from "@nextclaw/agent-chat-ui";
import type {
  ChatMessagePartSource,
} from "@/features/chat/types/chat-message.types";
import type {
  ToolCardViewSource,
} from "./chat-message-tool-card.utils";

const SHOW_CONTENT_TOOL_NAME = "show_content";

type ShowContentTargetType = ChatUiShowContentRequest["target"]["type"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && typeof value === "number" && value > 0
    ? value
    : undefined;
}

function readTargetType(value: unknown): ShowContentTargetType | null {
  return value === "file" || value === "url" || value === "panel_app"
    ? value
    : null;
}

function readPurpose(value: unknown): ChatUiShowContentRequest["purpose"] {
  return value === "read" || value === "preview" || value === "edit" || value === "interact"
    ? value
    : undefined;
}

function readPlacement(value: unknown): ChatUiShowContentRequest["placement"] {
  return value === "inline" || value === "side_panel"
    ? value
    : undefined;
}

function readFileViewer(value: unknown): NonNullable<
  Extract<ChatUiShowContentRequest["target"], { type: "file" }>["payload"]["viewer"]
> | undefined {
  return value === "auto" || value === "source" || value === "rendered"
    ? value
    : undefined;
}

function readShowContentRequest(value: unknown): ChatUiShowContentRequest | null {
  if (!isRecord(value) || !isRecord(value.target)) {
    return null;
  }
  const { target } = value;
  const {
    payload,
    type,
  } = target;
  const targetType = readTargetType(type);
  if (!targetType || !isRecord(payload)) {
    return null;
  }
  const title = readOptionalString(value.title);
  const purpose = readPurpose(value.purpose);
  const placement = readPlacement(value.placement);

  if (targetType === "file") {
    const path = readOptionalString(payload.path);
    if (!path) {
      return null;
    }
    return {
      target: {
        type: "file",
        payload: {
          path,
          line: readOptionalPositiveInteger(payload.line),
          column: readOptionalPositiveInteger(payload.column),
          viewer: readFileViewer(payload.viewer),
        },
      },
      title,
      purpose,
      placement,
    };
  }

  if (targetType === "url") {
    const url = readOptionalString(payload.url);
    if (!url) {
      return null;
    }
    return {
      target: {
        type: "url",
        payload: {
          url,
        },
      },
      title,
      purpose,
      placement,
    };
  }

  const appId = readOptionalString(payload.appId);
  if (!appId) {
    return null;
  }
  return {
    target: {
      type: "panel_app",
      payload: {
        appId,
      },
    },
    title,
    purpose,
    placement,
  };
}

function readShowContentResult(value: unknown): ChatUiShowContentRequest | null {
  if (!isRecord(value) || value.action !== "showContent") {
    return null;
  }
  return readShowContentRequest(value.request);
}

function summarizeShowContentRequest(request: ChatUiShowContentRequest): string {
  if (request.title) {
    return request.title;
  }
  if (request.target.type === "file") {
    return request.target.payload.path;
  }
  if (request.target.type === "url") {
    return request.target.payload.url;
  }
  return request.target.payload.appId;
}

export function buildShowContentToolCard(params: {
  invocation: Extract<ChatMessagePartSource, { type: "tool-invocation" }>["toolInvocation"];
  actionLabel: string;
  statusLabel: string;
}): ToolCardViewSource | null {
  const {
    actionLabel,
    invocation,
    statusLabel,
  } = params;
  if (invocation.toolName !== SHOW_CONTENT_TOOL_NAME) {
    return null;
  }
  const request = readShowContentResult(invocation.result);
  if (!request) {
    return null;
  }
  const sidePanelRequest: ChatUiShowContentRequest = {
    ...request,
    placement: "side_panel",
  };
  const showContentAction = {
    kind: "show-content" as const,
    label: actionLabel,
    request: sidePanelRequest,
  };
  const panelApp = request.target.type === "panel_app" && request.placement === "inline"
    ? {
        appId: request.target.payload.appId,
        title: request.title,
        action: showContentAction,
      }
    : undefined;
  return {
    kind: "result",
    name: SHOW_CONTENT_TOOL_NAME,
    detail: summarizeShowContentRequest(request),
    text: undefined,
    outputData: invocation.result,
    hasResult: true,
    statusTone: "success",
    statusLabel,
    action: showContentAction,
    ...(panelApp ? { panelApp } : {}),
  };
}
