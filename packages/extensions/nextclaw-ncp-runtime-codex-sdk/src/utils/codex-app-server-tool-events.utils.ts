import { performance } from "node:perf_hooks";
import {
  createNcpEndpointEvent,
  NcpEventType,
  type NcpEndpointEvent,
} from "@nextclaw/ncp";
import type { AppServerThreadItem } from "@/types/codex-app-server-runtime.types.js";
import {
  readAppServerToolArgs,
  readAppServerToolName,
  readAppServerToolResult,
  stringifyAppServerToolArgs,
} from "./codex-app-server-item-mapper.utils.js";

export type AppServerToolSnapshot = {
  callEmitted: boolean;
  executionStartedAt?: string;
  executionStartedMonotonic?: number;
};

type AppServerToolEventInput = {
  item: AppServerThreadItem;
  itemId: string;
  eventType: "item/started" | "item/completed";
  sessionId: string;
  messageId: string;
  toolState: Map<string, AppServerToolSnapshot>;
};

export function createAppServerToolEvents(input: AppServerToolEventInput): NcpEndpointEvent[] {
  const { eventType, item, itemId, messageId, sessionId, toolState } = input;
  const events: NcpEndpointEvent[] = [];
  const state = toolState.get(itemId) ?? { callEmitted: false };
  if (!state.callEmitted) {
    state.callEmitted = true;
    events.push(
      createNcpEndpointEvent({
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId,
          messageId,
          toolCallId: itemId,
          toolName: readAppServerToolName(item),
        },
      }),
      createNcpEndpointEvent({
        type: NcpEventType.MessageToolCallArgs,
        payload: {
          sessionId,
          toolCallId: itemId,
          args: stringifyAppServerToolArgs(readAppServerToolArgs(item)),
        },
      }),
      createNcpEndpointEvent({
        type: NcpEventType.MessageToolCallEnd,
        payload: { sessionId, toolCallId: itemId },
      }),
    );
  }
  if (
    item.type === "commandExecution" &&
    eventType === "item/started" &&
    !state.executionStartedAt
  ) {
    state.executionStartedAt = new Date().toISOString();
    state.executionStartedMonotonic = performance.now();
    events.push(createNcpEndpointEvent({
      type: NcpEventType.MessageToolExecutionStarted,
      payload: { sessionId, messageId, toolCallId: itemId },
    }, state.executionStartedAt));
  }
  if (eventType === "item/completed") {
    const endedAt = new Date().toISOString();
    const upstreamDurationMs = readNonNegativeNumber(item.durationMs);
    const execution = item.type === "commandExecution" && (
      upstreamDurationMs !== undefined || state.executionStartedAt
    )
      ? {
          ...(state.executionStartedAt ? { startedAt: state.executionStartedAt } : {}),
          endedAt,
          ...(upstreamDurationMs !== undefined
            ? { durationMs: upstreamDurationMs }
            : state.executionStartedMonotonic !== undefined
              ? { durationMs: Math.max(0, performance.now() - state.executionStartedMonotonic) }
              : {}),
        }
      : undefined;
    events.push(createNcpEndpointEvent({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId,
        toolCallId: itemId,
        content: readAppServerToolResult(item),
        final: true,
        ...(execution ? { execution } : {}),
      },
    }, endedAt));
  }
  toolState.set(itemId, state);
  return events;
}

function readNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
