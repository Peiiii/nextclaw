import {
  DefaultNcpAgentConversationStateManager,
  insertMessageByTimeline,
} from "@nextclaw/ncp-toolkit";
import {
  type NcpEndpointEvent,
  NcpEventType,
  type NcpMessage,
} from "@nextclaw/ncp";
import { ContextCompactionJournalRecoveryService } from "@kernel/features/context-compaction/index.js";
import {
  type NcpAgentSessionJournalReplayEvent,
} from "./ncp-agent-session-journal.utils.js";
import {
  createReplayEvent,
  createReplayStreamingBootstrapEvent,
  isJournalOnlyEvent,
  isStreamingMessageCreationEvent,
  readEventMessageId,
  readEventRunId,
  readMessageFromSummaryEvent,
  readReplayMessageId,
  readStreamingMessageId,
  readSupersededSyntheticRecoveryIndexes,
  type NcpAgentSessionReplayableEvent,
} from "./ncp-agent-session-replay-event.utils.js";

type NcpToolCallResultReplayPayload = Extract<
  NcpEndpointEvent,
  { type: NcpEventType.MessageToolCallResult }
>["payload"];

type ReplayContext = {
  stateManager: DefaultNcpAgentConversationStateManager;
  knownMessageIds: Set<string>;
  terminalMessageIds: Set<string>;
  toolResultsByCallId: Map<string, NcpToolCallResultReplayPayload>;
  compactionRecovery: ContextCompactionJournalRecoveryService;
  activeTailRunIds: Set<string>;
};

export async function replayNcpAgentSessionEvents(
  events: readonly NcpAgentSessionJournalReplayEvent[],
  seedMessages: readonly NcpMessage[] = [],
  activeMessageId?: string | null,
  allowUnknownStreamingBootstrap = true,
): Promise<NcpMessage[]> {
  const context = await createReplayContext(seedMessages, activeMessageId);
  await replayJournalEvents(context, events, allowUnknownStreamingBootstrap);
  const snapshot = context.stateManager.getSnapshot();
  const messages = snapshot.streamingMessage
    ? insertMessageByTimeline(snapshot.messages, snapshot.streamingMessage)
    : snapshot.messages;
  return messages.map(context.compactionRecovery.terminalize);
}

async function createReplayContext(
  seedMessages: readonly NcpMessage[],
  activeMessageId?: string | null,
): Promise<ReplayContext> {
  const stateManager = new DefaultNcpAgentConversationStateManager();
  if (seedMessages.length > 0) {
    stateManager.hydrate({
      sessionId: seedMessages[0]?.sessionId ?? "",
      messages: seedMessages
    });
  }
  const activeMessage = activeMessageId
    ? seedMessages.find((message) => message.id === activeMessageId)
    : undefined;
  if (activeMessage) {
    await stateManager.dispatch({
      occurredAt: activeMessage.timestamp,
      type: NcpEventType.MessageReasoningStart,
      payload: {
        sessionId: activeMessage.sessionId,
        messageId: activeMessage.id,
      },
    });
  }
  const knownMessageIds = new Set(seedMessages.map((message) => message.id));
  const terminalMessageIds = new Set(
    seedMessages
      .filter((message) => message.role === "assistant" && (message.status === "final" || message.status === "error"))
      .map((message) => message.id),
  );
  const toolResultsByCallId = new Map<string, NcpToolCallResultReplayPayload>();
  const compactionRecovery = new ContextCompactionJournalRecoveryService();
  compactionRecovery.seed(seedMessages);
  return {
    stateManager,
    knownMessageIds,
    terminalMessageIds,
    toolResultsByCallId,
    compactionRecovery,
    activeTailRunIds: new Set(),
  };
}

async function replayJournalEvents(
  context: ReplayContext,
  events: readonly NcpAgentSessionJournalReplayEvent[],
  allowUnknownStreamingBootstrap: boolean,
): Promise<void> {
  const supersededSyntheticRecoveryIndexes = readSupersededSyntheticRecoveryIndexes(events);
  for (const [eventIndex, event] of events.entries()) {
    if (isJournalOnlyEvent(event)) {
      continue;
    }
    const replayEvent = createReplayEvent(event, context.toolResultsByCallId);
    updateActiveTailRunIds(context.activeTailRunIds, replayEvent, eventIndex);
    if (supersededSyntheticRecoveryIndexes.has(eventIndex)) {
      continue;
    }
    await replayJournalEvent(context, replayEvent, allowUnknownStreamingBootstrap);
  }
}

function updateActiveTailRunIds(
  activeTailRunIds: Set<string>,
  event: NcpAgentSessionReplayableEvent,
  eventIndex: number,
): void {
  if (event.type === NcpEventType.RunStarted) {
    activeTailRunIds.add(
      event.payload.runId ?? event.payload.messageId ?? `run-event-${eventIndex}`,
    );
    return;
  }
  if (
    event.type !== NcpEventType.RunFinished &&
    event.type !== NcpEventType.RunError &&
    event.type !== NcpEventType.MessageAbort
  ) {
    return;
  }
  const runId = readEventRunId(event);
  if (runId) {
    activeTailRunIds.delete(runId);
  } else {
    activeTailRunIds.clear();
  }
}

async function replayJournalEvent(
  context: ReplayContext,
  replayEvent: NcpEndpointEvent,
  allowUnknownStreamingBootstrap: boolean,
): Promise<void> {
  const { activeTailRunIds, compactionRecovery, knownMessageIds, terminalMessageIds } = context;
  const streamingMessageId = readStreamingMessageId(replayEvent);
  if (streamingMessageId && terminalMessageIds.has(streamingMessageId)) {
    return;
  }
  // Preserve legacy journals that start streaming after RunStarted without a MessageSent,
  // but never resurrect an ID after the tail has observed a run terminal.
  if (
    streamingMessageId &&
    !allowUnknownStreamingBootstrap &&
    !knownMessageIds.has(streamingMessageId) &&
    !isStreamingMessageCreationEvent(replayEvent) &&
    activeTailRunIds.size === 0
  ) {
    return;
  }
  compactionRecovery.track(replayEvent);
  await dispatchReplayEvent(context, replayEvent, streamingMessageId, allowUnknownStreamingBootstrap);
  recordReplayTerminal(context, replayEvent);
}

async function dispatchReplayEvent(
  context: ReplayContext,
  replayEvent: NcpEndpointEvent,
  streamingMessageId: string | null,
  allowUnknownStreamingBootstrap: boolean,
): Promise<void> {
  const { knownMessageIds, stateManager, toolResultsByCallId } = context;
  const bootstrap = (allowUnknownStreamingBootstrap || isStreamingMessageCreationEvent(replayEvent))
    ? createReplayStreamingBootstrapEvent(replayEvent, knownMessageIds)
    : null;
  if (bootstrap) {
    knownMessageIds.add(bootstrap.messageId);
    await stateManager.dispatch(bootstrap.event);
  }
  const replayMessageId = readReplayMessageId(replayEvent);
  if (replayMessageId) {
    knownMessageIds.add(replayMessageId);
  }
  if (streamingMessageId && isStreamingMessageCreationEvent(replayEvent)) {
    knownMessageIds.add(streamingMessageId);
  }
  await stateManager.dispatch(replayEvent);
  if (
    replayEvent.type === NcpEventType.MessageToolCallResult &&
    replayEvent.payload.final !== false
  ) {
    toolResultsByCallId.set(replayEvent.payload.toolCallId, replayEvent.payload);
  }
}

function recordReplayTerminal(context: ReplayContext, replayEvent: NcpEndpointEvent): void {
  const replayMessage = readMessageFromSummaryEvent(replayEvent);
  if (
    replayMessage?.role === "assistant" &&
    (replayMessage.status === "final" || replayMessage.status === "error")
  ) {
    context.terminalMessageIds.add(replayMessage.id);
  }
  if (replayEvent.type === NcpEventType.RunError || replayEvent.type === NcpEventType.MessageAbort) {
    const messageId = readEventMessageId(replayEvent);
    if (messageId) {
      context.terminalMessageIds.add(messageId);
    }
  }
}
