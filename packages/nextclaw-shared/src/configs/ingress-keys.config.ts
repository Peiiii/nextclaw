import type {
  NcpAgentSendEnvelope,
  NcpMessage,
  NcpMessageAbortPayload,
  NcpMessagePart,
} from "@nextclaw/ncp";
import { createTypedKey } from "../types/typed-key.types.js";

export type ExtensionChannelTextContent = {
  type: "text";
  text: string;
};

type ExtensionChannelResourceRef = {
  url?: string;
  assetUri?: string;
  mimeType?: string;
  name?: string;
};

export type ExtensionChannelImageContent = ExtensionChannelResourceRef & { type: "image" };

export type ExtensionChannelFileContent = ExtensionChannelResourceRef & { type: "file" };

export type ExtensionChannelMessageContent =
  | ExtensionChannelTextContent
  | ExtensionChannelImageContent
  | ExtensionChannelFileContent;

export type ExtensionChannelSubmittedAttachment = ExtensionChannelResourceRef & {
  id?: string;
  path?: string;
  size?: number;
  source?: string;
  status?: "ready" | "remote-only";
  errorCode?: "too_large" | "download_failed" | "http_error" | "invalid_payload";
};

export type ExtensionChannelConfigGetIngressPayload = {
  channelId: string;
};

export type ExtensionChannelMessageSubmitIngressPayload = {
  channelId: string;
  conversationId: string;
  senderId: string;
  content: ExtensionChannelMessageContent;
  attachments?: ExtensionChannelSubmittedAttachment[];
  metadata?: Record<string, unknown>;
};

export type ExtensionChannelCommandOptionType = "string" | "boolean" | "number";

export type ExtensionChannelCommandOption = {
  name: string;
  description: string;
  type: ExtensionChannelCommandOptionType;
  required?: boolean;
};

export type ExtensionChannelCommandSpec = {
  name: string;
  description: string;
  options?: ExtensionChannelCommandOption[];
};

export type ExtensionChannelCommandListIngressPayload = {
  channelId: string;
};

export type ExtensionChannelCommandListResponse = {
  commands: ExtensionChannelCommandSpec[];
};

export type ExtensionChannelCommandExecuteIngressPayload = {
  channelId: string;
  conversationId: string;
  senderId: string;
  commandName?: string;
  rawText?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ExtensionChannelCommandExecuteResponse = {
  content: string;
  ephemeral?: boolean;
};

export type ExtensionResponseIngressPayload =
  | {
      requestId: string;
      ok: true;
      data?: unknown;
    }
  | {
      requestId: string;
      ok: false;
      error: {
        message: string;
      };
    };

export type AgentRunSessionMessageRequestPayload = {
  message: NcpMessage;
  requestId: string;
  sessionId: string;
};

export type AgentRunSendIngressMetadata = Record<string, unknown> & {
  agentRuntimeId?: string;
  agentId?: string;
  projectRoot?: string;
  channel?: string;
  model?: string;
  maxTokens?: number;
  thinkingEffort?: string | null;
  chatId?: string;
  accountId?: string;
  senderId?: string;
  sessionKey?: string;
  label?: string;
};

export type AgentRunSendIngressPayload =
  | (Omit<NcpAgentSendEnvelope, "metadata"> & {
      content?: never;
      metadata?: AgentRunSendIngressMetadata;
      peerId?: string;
    })
  | (Omit<NcpAgentSendEnvelope, "message" | "metadata"> & {
      content: NcpMessagePart[];
      metadata?: AgentRunSendIngressMetadata;
      message?: never;
      peerId?: string;
    });

export const ingressKeys = {
  extension: {
    channelConfigGet: createTypedKey<ExtensionChannelConfigGetIngressPayload>(
      "extension.channel.config.get",
    ),
    channelMessageSubmit:
      createTypedKey<ExtensionChannelMessageSubmitIngressPayload>(
        "extension.channel.message.submit",
      ),
    channelCommandList: createTypedKey<ExtensionChannelCommandListIngressPayload>(
      "extension.channel.command.list",
    ),
    channelCommandExecute:
      createTypedKey<ExtensionChannelCommandExecuteIngressPayload>(
        "extension.channel.command.execute",
      ),
    response: createTypedKey<ExtensionResponseIngressPayload>("extension.response"),
  },
  agentRun: {
    send: createTypedKey<AgentRunSendIngressPayload>("agent-run.send"),
    abort: createTypedKey<NcpMessageAbortPayload>("agent-run.abort"),
    sessionMessageRequest:
      createTypedKey<AgentRunSessionMessageRequestPayload>(
        "agent-run.session-message.request",
      ),
  },
} as const;
