import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import type { NcpMessagePart } from '@nextclaw/ncp';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  ChatRunView,
  ChatTurnStreamDeltaEvent,
  ChatTurnStreamReadyEvent,
  ChatTurnStreamSessionEvent,
  SessionMessageView,
  ThinkingLevel
} from '@/api/types';

export type SendMessageParams = {
  runId?: string;
  message: string;
  sessionKey: string;
  agentId: string;
  sessionType?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  requestedSkills?: string[];
  attachments?: NcpDraftAttachment[];
  parts?: NcpMessagePart[];
  stopSupported?: boolean;
  stopReason?: string;
  restoreDraftOnError?: boolean;
  composerNodes?: ChatComposerNode[];
};

export type ActiveRunState = {
  localRunId: number;
  sessionKey: string;
  agentId?: string;
  backendRunId?: string;
  backendStopSupported: boolean;
  backendStopReason?: string;
};

export type StreamReadyPayload = {
  sessionKey: string;
  runId?: string;
  stopSupported?: boolean;
  stopReason?: string;
  requestedAt?: string;
};

export type StreamReadyEvent = ChatTurnStreamReadyEvent;
export type StreamDeltaEvent = ChatTurnStreamDeltaEvent;
export type StreamSessionEvent = ChatTurnStreamSessionEvent;

export type NextbotAgentRunMetadata =
  | {
      driver: 'nextbot-stream';
      mode: 'send';
      payload: SendMessageParams;
      requestedSkills: string[];
    }
  | {
      driver: 'nextbot-stream';
      mode: 'resume';
      runId: string;
      fromEventIndex?: number;
      sessionKey?: string;
      agentId?: string;
      stopSupported?: boolean;
      stopReason?: string;
    };

export type UseChatStreamControllerParams = {
  selectedSessionKeyRef: MutableRefObject<string | null>;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  setComposerNodes: Dispatch<SetStateAction<ChatComposerNode[]>>;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
};

export type ChatStreamActions = {
  sendMessage: (payload: SendMessageParams) => Promise<void>;
  stopCurrentRun: () => Promise<void>;
  resumeRun: (run: ChatRunView) => Promise<void>;
  resetStreamState: () => void;
  applyHistoryMessages: (messages: SessionMessageView[], options?: { isLoading?: boolean }) => void;
};
