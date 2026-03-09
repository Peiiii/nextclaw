import { sendChatTurnStream, stopChatTurn, streamChatRun } from '@/api/config';
import type { ActiveRunState, PendingChatMessage, StreamDeltaEvent, StreamReadyEvent, StreamSessionEvent } from './types';

function buildSendTurnPayload(item: PendingChatMessage, requestedSkills: string[]) {
  const metadata: Record<string, unknown> = {};
  if (item.sessionType) {
    metadata.session_type = item.sessionType;
  }
  if (requestedSkills.length > 0) {
    metadata.requested_skills = requestedSkills;
  }
  return {
    message: item.message,
    sessionKey: item.sessionKey,
    agentId: item.agentId,
    ...(item.model ? { model: item.model } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    channel: 'ui',
    chatId: 'web-ui'
  };
}

export async function openSendTurnStream(params: {
  item: PendingChatMessage;
  requestedSkills: string[];
  signal: AbortSignal;
  onReady: (event: StreamReadyEvent) => void;
  onDelta: (event: StreamDeltaEvent) => void;
  onSessionEvent: (event: StreamSessionEvent) => void;
}) {
  return sendChatTurnStream(buildSendTurnPayload(params.item, params.requestedSkills), {
    signal: params.signal,
    onReady: params.onReady,
    onDelta: params.onDelta,
    onSessionEvent: params.onSessionEvent
  });
}

export async function openResumeRunStream(params: {
  runId: string;
  signal: AbortSignal;
  onReady: (event: StreamReadyEvent) => void;
  onDelta: (event: StreamDeltaEvent) => void;
  onSessionEvent: (event: StreamSessionEvent) => void;
}) {
  return streamChatRun(
    {
      runId: params.runId
    },
    {
      signal: params.signal,
      onReady: params.onReady,
      onDelta: params.onDelta,
      onSessionEvent: params.onSessionEvent
    }
  );
}

export async function requestStopRun(activeRun: ActiveRunState): Promise<void> {
  if (!activeRun.backendRunId) {
    return;
  }

  try {
    await stopChatTurn({
      runId: activeRun.backendRunId,
      sessionKey: activeRun.sessionKey,
      ...(activeRun.agentId ? { agentId: activeRun.agentId } : {})
    });
  } catch {
    // Keep local abort as fallback even if stop API fails.
  }
}
