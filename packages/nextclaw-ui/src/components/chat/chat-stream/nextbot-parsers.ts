import type { RunMetadataParsers } from '@nextclaw/agent-chat';
import type { ChatRunView } from '@/api/types';
import type { NextbotAgentRunMetadata, SendMessageParams } from '@/components/chat/chat-stream/types';

export const nextbotParsers: RunMetadataParsers = {
  parseReady: (metadata) => {
    if (metadata.driver !== 'nextbot-stream' || metadata.kind !== 'ready') {
      return null;
    }
    return {
      remoteRunId: typeof metadata.backendRunId === 'string' ? metadata.backendRunId : undefined,
      sessionId: typeof metadata.sessionKey === 'string' ? metadata.sessionKey : undefined,
      stopCapable: typeof metadata.stopSupported === 'boolean' ? metadata.stopSupported : undefined,
      stopReason: typeof metadata.stopReason === 'string' ? metadata.stopReason : undefined
    };
  },
  parseFinal: (metadata) => {
    if (metadata.driver !== 'nextbot-stream' || metadata.kind !== 'final') {
      return null;
    }
    return {
      sessionId: typeof metadata.sessionKey === 'string' ? metadata.sessionKey : undefined,
      hasOutput: Boolean(metadata.hasAssistantSessionEvent)
    };
  }
};

export function buildSendMetadata(payload: SendMessageParams, requestedSkills: string[]): NextbotAgentRunMetadata {
  return {
    driver: 'nextbot-stream',
    mode: 'send',
    payload,
    requestedSkills
  };
}

export function buildResumeMetadata(run: ChatRunView): NextbotAgentRunMetadata {
  const fromEventIndex =
    Number.isFinite(run.eventCount) && run.eventCount > 0
      ? Math.max(0, Math.trunc(run.eventCount))
      : undefined;
  return {
    driver: 'nextbot-stream',
    mode: 'resume',
    runId: run.runId!,
    ...(typeof fromEventIndex === 'number' ? { fromEventIndex } : {}),
    sessionKey: run.sessionKey,
    ...(run.agentId ? { agentId: run.agentId } : {}),
    stopSupported: run.stopSupported,
    ...(run.stopReason ? { stopReason: run.stopReason } : {})
  };
}
