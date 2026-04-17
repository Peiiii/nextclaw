import type * as acp from "@agentclientprotocol/sdk";
import { readString } from "./stdio-runtime-config.utils.js";

type AcpToolCallUpdate = Extract<acp.SessionUpdate, { sessionUpdate: "tool_call" }>;

export function resolveToolNameFromAcpUpdate(update: AcpToolCallUpdate): string {
  return (
    resolveToolNameFromRawInput(update.rawInput) ??
    resolveHermesAcpToolNameFromTitle(update.title) ??
    readString(update.title) ??
    "unknown"
  );
}

function resolveToolNameFromRawInput(rawInput: unknown): string | undefined {
  if (typeof rawInput !== "object" || !rawInput || Array.isArray(rawInput)) {
    return undefined;
  }
  const input = rawInput as Record<string, unknown>;
  return readString(input.toolName) ?? readString(input.tool);
}

function resolveHermesAcpToolNameFromTitle(title: unknown): string | undefined {
  const normalizedTitle = readString(title)?.toLowerCase();
  if (!normalizedTitle) {
    return undefined;
  }
  if (normalizedTitle.startsWith("terminal:")) {
    return "terminal";
  }
  if (normalizedTitle.startsWith("read:")) {
    return "read_file";
  }
  if (normalizedTitle.startsWith("write:")) {
    return "write_file";
  }
  if (normalizedTitle.startsWith("patch (") || normalizedTitle.startsWith("patch:")) {
    return "patch";
  }
  if (normalizedTitle.startsWith("search:")) {
    return "search_files";
  }
  if (normalizedTitle.startsWith("web search:")) {
    return "web_search";
  }
  if (normalizedTitle === "web extract" || normalizedTitle.startsWith("extract:")) {
    return "web_extract";
  }
  if (normalizedTitle === "delegate task" || normalizedTitle.startsWith("delegate:")) {
    return "delegate_task";
  }
  if (normalizedTitle === "execute code") {
    return "execute_code";
  }
  if (normalizedTitle.startsWith("analyze image:")) {
    return "vision_analyze";
  }
  return undefined;
}
