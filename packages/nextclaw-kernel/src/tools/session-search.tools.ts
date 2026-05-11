import type { NcpTool } from "@nextclaw/ncp";
import {
  DEFAULT_SESSION_SEARCH_LIMIT,
  MAX_SESSION_SEARCH_LIMIT,
  type SessionSearchRequest,
  type SessionSearchResult,
} from "@nextclaw/core";
import { normalizeString } from "@kernel/utils/ncp-message-bridge.utils.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export class SessionSearchTool implements NcpTool {
  readonly name = "session_search";
  readonly description =
    "Search prior sessions by keyword and return structured hits with snippets. Use it to recall earlier discussions before creating new plans or summaries.";
  readonly parameters = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Keyword search query for prior session text or labels.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_SESSION_SEARCH_LIMIT,
        description: `Optional max hit count. Defaults to ${DEFAULT_SESSION_SEARCH_LIMIT}.`,
      },
      includeCurrentSession: {
        type: "boolean",
        description: "Set true to include the current session in results. Defaults to false.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  };

  constructor(
    private readonly queryService: {
      search: (request: SessionSearchRequest) => Promise<SessionSearchResult>;
    },
    private readonly context: {
      currentSessionId?: string;
    },
  ) {}

  validateArgs = (args: Record<string, unknown>): string[] => {
    const issues: string[] = [];
    const query = normalizeString(args.query);
    const limit = readOptionalInteger(args.limit);
    const includeCurrentSession = readOptionalBoolean(args.includeCurrentSession);

    if (!query) {
      issues.push("query must be a non-empty string.");
    }
    if (typeof args.limit !== "undefined" && typeof limit === "undefined") {
      issues.push("limit must be a finite integer.");
    }
    if (typeof limit === "number" && (limit < 1 || limit > MAX_SESSION_SEARCH_LIMIT)) {
      issues.push(`limit must be between 1 and ${MAX_SESSION_SEARCH_LIMIT}.`);
    }
    if (
      typeof args.includeCurrentSession !== "undefined" &&
      typeof includeCurrentSession === "undefined"
    ) {
      issues.push("includeCurrentSession must be a boolean.");
    }

    return issues;
  };

  execute = async (args: unknown): Promise<unknown> => {
    if (!isRecord(args)) {
      throw new Error("session_search requires an object argument.");
    }

    const issues = this.validateArgs(args);
    if (issues.length > 0) {
      throw new Error(issues.join(" "));
    }

    return this.queryService.search({
      query: normalizeString(args.query) ?? "",
      limit: readOptionalInteger(args.limit),
      includeCurrentSession: readOptionalBoolean(args.includeCurrentSession),
      currentSessionId: this.context.currentSessionId,
    });
  };
}
