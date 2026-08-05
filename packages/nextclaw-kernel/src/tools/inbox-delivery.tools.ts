import { readFile, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import { MAX_INBOX_DELIVERY_CONTENT_LENGTH } from "@kernel/managers/inbox-delivery.manager.js";
import {
  normalizeToolParams,
  type ToolExecutionContext,
} from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import type { InboxDeliverySource } from "@nextclaw/shared";

type InboxDeliveryToolSource = Pick<
  InboxDeliverySource,
  "agentId" | "sessionId"
>;

type InboxDeliveryRequest = {
  title: string;
  summary: string | null;
  content: string | null;
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
  return {
    title: readRequiredString(params.title, "title"),
    summary: readOptionalString(params.summary),
    content,
    filePath,
  };
}

class DeliverToInboxTool implements NcpTool {
  readonly name = "deliver_to_inbox";
  readonly description =
    "Deliver a durable Markdown report, recommendation, or article to the user's NextClaw inbox. Use content for direct Markdown or filePath to snapshot a local UTF-8 text file. The user can read it later and continue in a new chat.";
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
        description: "Markdown content. Provide exactly one of content or filePath.",
      },
      filePath: {
        type: "string",
        description: "Absolute path to a UTF-8 Markdown or text file to snapshot.",
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
