import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import type { NcpMessagePart } from '@nextclaw/ncp';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import type { ThinkingLevel } from '@/shared/lib/api';

export type SendMessageParams = {
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

export type ResumeRunParams = {
  sessionKey: string;
};

export type ChatStreamActions = {
  sendMessage: (payload: SendMessageParams) => Promise<void>;
  stopCurrentRun: () => Promise<void>;
  resumeRun: (run: ResumeRunParams) => Promise<void>;
  resetStreamState: () => void;
  applyHistoryMessages: (messages: unknown[], options?: { isLoading?: boolean }) => void;
};
