import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";
import type { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import { MAX_INBOX_DELIVERY_CONTENT_LENGTH } from "@kernel/managers/inbox-delivery.manager.js";
import {
  normalizeToolParams,
  type ToolExecutionContext,
} from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import type {
  InboxDeliveryContentType,
  InboxDeliverySource,
} from "@nextclaw/shared";

type InboxDeliveryToolSource = Pick<
  InboxDeliverySource,
  "agentId" | "sessionId"
>;

type InboxDeliveryRequest = {
  title: string;
  summary: string | null;
  content: string | null;
  contentType: InboxDeliveryContentType;
  filePath: string | null;
};

function readRequiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return value.trim() || null;
}

function readContentType(value: unknown): InboxDeliveryContentType | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value !== "markdown" && value !== "html") {
    throw new Error("contentType must be markdown or html.");
  }
  return value;
}

function normalizeRequest(args: unknown): InboxDeliveryRequest {
  const params = normalizeToolParams(args);
  const content = readOptionalString(params.content);
  const filePath = readOptionalString(params.filePath);
  if (Boolean(content) === Boolean(filePath)) {
    throw new Error("exactly one of content or filePath must be provided.");
  }
  if (filePath && !isAbsolute(filePath)) {
    throw new Error("filePath must be an absolute path.");
  }
  const requestedContentType = readContentType(params.contentType);
  return {
    title: readRequiredString(params.title, "title"),
    summary: readOptionalString(params.summary),
    content,
    contentType: requestedContentType ?? (
      filePath && [".htm", ".html"].includes(extname(filePath).toLowerCase())
        ? "html"
        : "markdown"
    ),
    filePath,
  };
}

class DeliverToInboxTool implements NcpTool {
  readonly name = "deliver_to_inbox";
  readonly description =
    "Deliver durable reading material to the user's NextClaw inbox. Prefer this for collected news, briefings, reports, recommendations, or articles when the user can read later and did not explicitly request an external chat channel. Accepts Markdown or static HTML via content, or snapshots a local UTF-8 filePath; .html and .htm files are detected automatically. The user can continue from the delivery in a new chat.";
  readonly parameters: NcpTool["parameters"] = {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Concise user-facing title, at most 160 characters.",
      },
      summary: {
        type: "string",
        description: "Optional one-paragraph summary, at most 500 characters.",
      },
      content: {
        type: "string",
        description: "Markdown or static HTML content. Provide exactly one of content or filePath.",
      },
      contentType: {
        type: "string",
        enum: ["markdown", "html"],
        description: "Content format. Defaults to HTML for .html/.htm files and Markdown otherwise.",
      },
      filePath: {
        type: "string",
        description: "Absolute path to a UTF-8 Markdown, HTML, or text file to snapshot.",
      },
    },
    required: ["title"],
    additionalProperties: false,
  };

  constructor(
    private readonly manager: InboxDeliveryManager,
    private readonly source: InboxDeliveryToolSource,
  ) {}

  execute = async (
    args: unknown,
    context?: ToolExecutionContext,
  ): Promise<unknown> => {
    const request = normalizeRequest(args);
    const content = request.content ?? await this.readFileContent(request.filePath as string);
    const delivery = await this.manager.createDelivery({
      title: request.title,
      summary: request.summary,
      content,
      contentType: request.contentType,
      source: {
        kind: "agent",
        agentId: this.source.agentId,
        sessionId: this.source.sessionId,
        toolCallId: readOptionalString(context?.toolCallId),
        filePath: request.filePath,
      },
    });
    return {
      ok: true,
      deliveryId: delivery.id,
      title: delivery.title,
    };
  };

  private readFileContent = async (filePath: string): Promise<string> => {
    const file = await stat(filePath);
    if (!file.isFile()) {
      throw new Error("filePath must point to a regular file.");
    }
    if (file.size > MAX_INBOX_DELIVERY_CONTENT_LENGTH) {
      throw new Error(`filePath must be at most ${MAX_INBOX_DELIVERY_CONTENT_LENGTH} bytes.`);
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(await readFile(filePath));
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error("filePath must contain valid UTF-8 text.");
      }
      throw error;
    }
  };
}

export function createInboxDeliveryTools(
  manager: InboxDeliveryManager,
  source: InboxDeliveryToolSource,
): readonly NcpTool[] {
  return [new DeliverToInboxTool(manager, source)];
}
