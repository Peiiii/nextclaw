import type { ThreadEvent, ThreadItem } from "@openai/codex-sdk";
import { type NcpEndpointEvent, NcpEventType } from "@nextclaw/ncp";

type ToolLikeItem = Extract<
  ThreadItem,
  { type: "mcp_tool_call" | "command_execution" | "web_search" | "file_change" | "todo_list" }
>;

export type ItemTextSnapshot = {
  text: string;
  started: boolean;
};

export type ToolSnapshot = {
  started: boolean;
  argsEmitted: boolean;
  ended: boolean;
};

const TEXT_DELTA_CHUNK_SIZE = 32;

function buildToolDescriptor(item: ToolLikeItem): { toolName: string; args: unknown } {
  switch (item.type) {
    case "mcp_tool_call":
      return {
        toolName: item.server ? `mcp:${item.server}.${item.tool}` : `mcp:${item.tool}`,
        args: item.arguments,
      };
    case "command_execution":
      return {
        toolName: "command_execution",
        args: {
          command: item.command,
        },
      };
    case "web_search":
      return {
        toolName: "web_search",
        args: {
          query: item.query,
        },
      };
    case "file_change":
      return {
        toolName: "file_change",
        args: {
          changes: item.changes,
        },
      };
    case "todo_list":
      return {
        toolName: "todo_list",
        args: {
          items: item.items,
        },
      };
  }
}

function buildToolResult(item: ToolLikeItem): unknown {
  switch (item.type) {
    case "mcp_tool_call":
      return item.status === "failed"
        ? { ok: false, error: item.error ?? { message: "MCP tool call failed." } }
        : {
            ok: item.status === "completed",
            status: item.status,
            result: item.result ?? null,
          };
    case "command_execution":
      return {
        status: item.status,
        command: item.command,
        aggregated_output: item.aggregated_output,
        ...(typeof item.exit_code === "number" ? { exit_code: item.exit_code } : {}),
      };
    case "web_search":
      return {
        status: "completed",
        query: item.query,
      };
    case "file_change":
      return {
        status: item.status,
        changes: item.changes,
      };
    case "todo_list":
      return {
        status: "completed",
        items: item.items,
      };
  }
}

function stringifyToolArgs(args: unknown): string {
  try {
    return JSON.stringify(args ?? {});
  } catch {
    return JSON.stringify({
      __serialization_error__: "tool arguments are not JSON serializable",
    });
  }
}

function isToolLikeItem(item: ThreadItem): item is ToolLikeItem {
  return (
    item.type === "mcp_tool_call" ||
    item.type === "command_execution" ||
    item.type === "web_search" ||
    item.type === "file_change" ||
    item.type === "todo_list"
  );
}

function splitTextDelta(delta: string): string[] {
  if (delta.length <= TEXT_DELTA_CHUNK_SIZE) {
    return delta ? [delta] : [];
  }
  const chunks: string[] = [];
  for (let index = 0; index < delta.length; index += TEXT_DELTA_CHUNK_SIZE) {
    chunks.push(delta.slice(index, index + TEXT_DELTA_CHUNK_SIZE));
  }
  return chunks;
}

function* mapTextSnapshotDelta(params: {
  currentText: string;
  deltaType: typeof NcpEventType.MessageTextDelta | typeof NcpEventType.MessageReasoningDelta;
  endType: typeof NcpEventType.MessageTextEnd | typeof NcpEventType.MessageReasoningEnd;
  eventType: "item.started" | "item.updated" | "item.completed";
  itemId: string;
  itemTextById: Map<string, ItemTextSnapshot>;
  messageId: string;
  sessionId: string;
  startType: typeof NcpEventType.MessageTextStart | typeof NcpEventType.MessageReasoningStart;
}): Generator<NcpEndpointEvent> {
  const { currentText, itemId, itemTextById, messageId, sessionId } = params;
  const previous = itemTextById.get(itemId) ?? { text: "", started: false };
  if (!previous.started) {
    yield {
      type: params.startType,
      payload: { sessionId, messageId },
    };
  }
  if (currentText.length > previous.text.length) {
    const delta = currentText.slice(previous.text.length);
    for (const chunk of splitTextDelta(delta)) {
      yield {
        type: params.deltaType,
        payload: { sessionId, messageId, delta: chunk },
      };
    }
  }
  itemTextById.set(itemId, { text: currentText, started: true });
  if (params.eventType === "item.completed") {
    yield {
      type: params.endType,
      payload: { sessionId, messageId },
    };
  }
}

export async function* mapCodexItemEvent(params: {
  sessionId: string;
  messageId: string;
  event: Extract<ThreadEvent, { type: "item.started" | "item.updated" | "item.completed" }>;
  itemTextById: Map<string, ItemTextSnapshot>;
  toolStateById: Map<string, ToolSnapshot>;
}): AsyncGenerator<NcpEndpointEvent> {
  const { sessionId, messageId, event, itemTextById, toolStateById } = params;
  const { item } = event;

  if (item.type === "agent_message") {
    yield* mapTextSnapshotDelta({
      currentText: item.text ?? "",
      deltaType: NcpEventType.MessageTextDelta,
      endType: NcpEventType.MessageTextEnd,
      eventType: event.type,
      itemId: item.id,
      itemTextById,
      messageId,
      sessionId,
      startType: NcpEventType.MessageTextStart,
    });
    return;
  }

  if (item.type === "reasoning") {
    itemTextById.delete(item.id);
    return;
  }

  if (!isToolLikeItem(item)) {
    return;
  }

  const previous = toolStateById.get(item.id) ?? {
    started: false,
    argsEmitted: false,
    ended: false,
  };
  const descriptor = buildToolDescriptor(item);

  if (!previous.started) {
    yield {
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId,
        messageId,
        toolCallId: item.id,
        toolName: descriptor.toolName,
      },
    };
    previous.started = true;
  }

  if (!previous.argsEmitted) {
    yield {
      type: NcpEventType.MessageToolCallArgs,
      payload: {
        sessionId,
        toolCallId: item.id,
        args: stringifyToolArgs(descriptor.args),
      },
    };
    previous.argsEmitted = true;
  }

  if (!previous.ended) {
    yield {
      type: NcpEventType.MessageToolCallEnd,
      payload: {
        sessionId,
        toolCallId: item.id,
      },
    };
    previous.ended = true;
  }

  if (event.type === "item.updated" || event.type === "item.completed") {
    yield {
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId,
        toolCallId: item.id,
        content: buildToolResult(item),
      },
    };
  }

  toolStateById.set(item.id, previous);
}
