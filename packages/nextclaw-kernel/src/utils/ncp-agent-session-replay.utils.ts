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
  readEventToolCallId,
  readMessageFromSummaryEvent,
  readReplayMessageId,
  readStreamingMessageId,
  readSupersededSyntheticRecoveryIndexes,
  type NcpAgentSessionReplayableEvent,
} from "./ncp-agent-session-replay-event.utils.js";
import { seedReplayToolOwners, readReplayToolOwners } from "./ncp-agent-session-replay-tool-ownership.utils.js";

type NcpToolCallResultReplayPayload = Extract<
  NcpEndpointEvent,
  { type: NcpEventType.MessageToolCallResult }
>["payload"];

class ReplayContext {
  readonly knownMessageIds: Set<string>;
  readonly terminalMessageIds: Set<string>;
  readonly toolResultsByCallId = new Map<string, NcpToolCallResultReplayPayload>();
  readonly compactionRecovery = new ContextCompactionJournalRecoveryService();
  readonly activeTailRunIds = new Set<string>();
  readonly toolOwners: Map<string, string>;

  constructor(readonly stateManager: DefaultNcpAgentConversationStateManager, seeds: readonly NcpMessage[]) {
    this.knownMessageIds = new Set(seeds.map(message => message.id));
    this.terminalMessageIds = new Set(seeds.filter(message => message.role === "assistant" && (message.status === "final" || message.status === "error")).map(message => message.id));
    this.toolOwners = seedReplayToolOwners(seeds);
    this.compactionRecovery.seed(seeds);
  }

  recordEvent = (event: NcpEndpointEvent, activeMessageId?: string): void => {
    for (const [callId, messageId] of readReplayToolOwners(event)) this.toolOwners.set(callId, messageId);
    const message = readMessageFromSummaryEvent(event);
    if (message?.role === "assistant" && (message.status === "final" || message.status === "error")) {
      this.terminalMessageIds.add(message.id);
    }
    if (event.type === NcpEventType.RunError || event.type === NcpEventType.RunFinished || event.type === NcpEventType.MessageAbort) {
      const messageId = readEventMessageId(event) ?? activeMessageId;
      if (messageId) this.terminalMessageIds.add(messageId);
    }
  };
}

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
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: activeMessage.sessionId,
        message: activeMessage,
      },
    });
  }
  return new ReplayContext(stateManager, seedMessages);
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
  sourceEvent: NcpEndpointEvent,
  allowUnknownStreamingBootstrap: boolean,
): Promise<void> {
  let replayEvent = sourceEvent;
  const { activeTailRunIds, compactionRecovery, knownMessageIds, terminalMessageIds, stateManager, toolOwners, recordEvent } = context;
  const summary = readMessageFromSummaryEvent(replayEvent);
  if (summary && (summary.status === "pending" || summary.status === "streaming") && terminalMessageIds.has(summary.id)) return;
  if (replayEvent.type === NcpEventType.MessageToolCallStart && !replayEvent.payload.messageId) {
    const activeId = stateManager.getSnapshot().streamingMessage?.id;
    if (!activeId) {
      console.warn(`[ncp-agent-session-journal] ignored tool start without a message: ${replayEvent.payload.toolCallId}`);
      return;
    }
    replayEvent = { ...replayEvent, payload: { ...replayEvent.payload, messageId: activeId } };
  }
  const toolCallId = readEventToolCallId(replayEvent);
  const toolOwner = toolCallId ? toolOwners.get(toolCallId) : undefined;
  if (toolCallId && replayEvent.type !== NcpEventType.MessageToolCallStart && !toolOwner) {
    console.warn(`[ncp-agent-session-journal] ignored unowned ${replayEvent.type}: ${toolCallId}`);
    return;
  }
  if (toolOwner && terminalMessageIds.has(toolOwner) && replayEvent.type !== NcpEventType.MessageToolCallResult) return;
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
  const activeMessageId = stateManager.getSnapshot().streamingMessage?.id;
  await dispatchReplayEvent(context, replayEvent, streamingMessageId, allowUnknownStreamingBootstrap);
  recordEvent(replayEvent, activeMessageId);
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
