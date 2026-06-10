import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import type {
  NcpAgentSendEnvelope,
  NcpMessage,
  NcpMessagePart,
  NcpRunHandle,
} from '@nextclaw/ncp';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import type { SessionContextWindowView, ThinkingLevel } from '@/shared/lib/api';

export type SendMessageParams = {
  message: string;
  sessionKey?: string;
  agentId: string;
  sessionType?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  projectRoot?: string | null;
  requestedSkills?: string[];
  attachments?: NcpDraftAttachment[];
  parts?: NcpMessagePart[];
  composerNodes?: ChatComposerNode[];
};

export type ChatRunRuntime = {
  sessionKey: string | null;
  sendEnvelope: (envelope: NcpAgentSendEnvelope) => Promise<NcpRunHandle | null>;
  abortCurrentRun: () => Promise<void>;
  resumeCurrentSessionRun: () => Promise<void>;
};

export type ChatRunSnapshot = {
  routeSessionKey: string | null;
  isHydrating: boolean;
  isSending: boolean;
  isRunning: boolean;
  visibleMessages: readonly NcpMessage[];
  contextWindow: SessionContextWindowView | null;
  sendErrorMessage: string | null;
  materializedSessionKey: string | null;
};
