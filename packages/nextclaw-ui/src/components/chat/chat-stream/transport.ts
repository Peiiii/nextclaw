import { fetchChatRuns, sendChatTurnStream, stopChatTurn, streamChatRun } from '@/api/config';
import type { ActiveRunState, SendMessageParams, StreamDeltaEvent, StreamReadyEvent, StreamSessionEvent } from './types';

function buildSendTurnPayload(item: SendMessageParams, requestedSkills: string[]) {
  const metadata: Record<string, unknown> = {};
  if (item.sessionType) {
    metadata.session_type = item.sessionType;
  }
  if (requestedSkills.length > 0) {
    metadata.requested_skills = requestedSkills;
  }
  return {
    message: item.message,
    ...(item.runId ? { runId: item.runId } : {}),
    sessionKey: item.sessionKey,
    agentId: item.agentId,
    ...(item.model ? { model: item.model } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    channel: 'ui',
    chatId: 'web-ui'
  };
}

export async function openSendTurnStream(params: {
  item: SendMessageParams;
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
  fromEventIndex?: number;
  signal: AbortSignal;
  onReady: (event: StreamReadyEvent) => void;
  onDelta: (event: StreamDeltaEvent) => void;
  onSessionEvent: (event: StreamSessionEvent) => void;
}) {
  return streamChatRun(
    {
      runId: params.runId,
      ...(typeof params.fromEventIndex === 'number' ? { fromEventIndex: params.fromEventIndex } : {})
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
  if (!activeRun.backendStopSupported) {
    return;
  }

  try {
    const attemptedRunIds = new Set<string>();
    const knownRunId = activeRun.backendRunId?.trim();
    if (knownRunId) {
      attemptedRunIds.add(knownRunId);
      const stopped = await stopRunById(knownRunId);
      if (stopped) {
        return;
      }
    }

    const candidateRunIds = await resolveStopCandidateRunIds(activeRun);
    for (const runId of candidateRunIds) {
      if (attemptedRunIds.has(runId)) {
        continue;
      }
      attemptedRunIds.add(runId);
      const stopped = await stopRunById(runId);
      if (stopped) {
        return;
      }
    }
    if (knownRunId) {
      const stopped = await stopRunById(knownRunId);
      if (stopped) {
        return;
      }
    }
  } catch {
    // Keep local abort as fallback even if stop API fails.
  }
}

async function stopRunById(runId: string): Promise<boolean> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    return false;
  }
  try {
    const result = await stopChatTurn({
      runId: normalizedRunId
    });
    return result.stopped === true;
  } catch {
    return false;
  }
}

async function resolveStopCandidateRunIds(activeRun: ActiveRunState): Promise<string[]> {
  const sessionKey = activeRun.sessionKey?.trim();
  if (!sessionKey) {
    return [];
  }
  const attempts = 8;
  const delayMs = 120;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const runIds = await listActiveRunIdsBySession(activeRun, sessionKey);
    if (runIds.length > 0) {
      return runIds;
    }
    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }
  return [];
}

async function listActiveRunIdsBySession(activeRun: ActiveRunState, sessionKey: string): Promise<string[]> {
  try {
    const response = await fetchChatRuns({
      sessionKey,
      states: ['queued', 'running'],
      limit: 50
    });
    const primary = response.runs
      .filter((run) => run.runId?.trim() && run.sessionKey === sessionKey && run.agentId === activeRun.agentId)
      .map((run) => run.runId.trim());
    if (primary.length > 0) {
      return primary;
    }
    return response.runs
      .filter((run) => run.runId?.trim() && run.sessionKey === sessionKey)
      .map((run) => run.runId.trim());
  } catch {
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
