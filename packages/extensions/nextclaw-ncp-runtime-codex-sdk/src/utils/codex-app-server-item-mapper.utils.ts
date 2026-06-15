import type { AppServerThreadItem } from "@/types/codex-app-server-runtime.types.js";

export function readAppServerReasoningText(
  item: AppServerThreadItem,
): string | undefined {
  const content = Array.isArray(item.content)
    ? item.content.filter((value): value is string => typeof value === "string")
    : [];
  if (content.length > 0) {
    return content.join("");
  }
  const summary = Array.isArray(item.summary)
    ? item.summary.filter((value): value is string => typeof value === "string")
    : [];
  return summary.length > 0 ? summary.join("\n") : undefined;
}

export function isAppServerToolLikeItem(type: unknown): boolean {
  return (
    type === "mcpToolCall" ||
    type === "dynamicToolCall" ||
    type === "commandExecution" ||
    type === "webSearch" ||
    type === "fileChange" ||
    type === "plan"
  );
}

export function readAppServerToolName(item: AppServerThreadItem): string {
  if (item.type === "mcpToolCall") {
    const server = readString(item.server);
    const tool = readString(item.tool) ?? "tool";
    return server ? `mcp:${server}.${tool}` : `mcp:${tool}`;
  }
  if (item.type === "dynamicToolCall") {
    const namespace = readString(item.namespace);
    const tool = readString(item.tool) ?? "tool";
    return namespace ? `${namespace}.${tool}` : tool;
  }
  return readString(item.type) ?? "tool";
}

export function readAppServerToolArgs(item: AppServerThreadItem): unknown {
  if (item.type === "mcpToolCall" || item.type === "dynamicToolCall") {
    return item.arguments;
  }
  if (item.type === "commandExecution") {
    return { command: item.command, cwd: item.cwd };
  }
  if (item.type === "webSearch") {
    return { query: item.query, action: item.action };
  }
  if (item.type === "fileChange") {
    return { changes: item.changes };
  }
  if (item.type === "plan") {
    return { text: item.text };
  }
  return {};
}

export function readAppServerToolResult(item: AppServerThreadItem): unknown {
  if (item.type === "mcpToolCall" || item.type === "dynamicToolCall") {
    return {
      status: item.status,
      result: item.result ?? item.contentItems ?? null,
      error: item.error ?? null,
    };
  }
  if (item.type === "commandExecution") {
    return {
      status: item.status,
      command: item.command,
      aggregated_output: item.aggregatedOutput,
      exit_code: item.exitCode,
    };
  }
  return item;
}

export function stringifyAppServerToolArgs(args: unknown): string {
  try {
    return JSON.stringify(args ?? {});
  } catch {
    return JSON.stringify({
      __serialization_error__: "tool arguments are not JSON serializable",
    });
  }
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
