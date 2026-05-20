import type { NcpMessage } from "@nextclaw/ncp";
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

export type AgentRuntimeSessionMessageIngressPayload = {
  message: NcpMessage;
  requestId: string;
  sessionId: string;
};

export const ingressKeys = {
  extension: {
    channelConfigGet: createTypedKey<ExtensionChannelConfigGetIngressPayload>(
      "extension.channel.config.get",
    ),
    channelMessageSubmit:
      createTypedKey<ExtensionChannelMessageSubmitIngressPayload>(
        "extension.channel.message.submit",
      ),
    response: createTypedKey<ExtensionResponseIngressPayload>("extension.response"),
  },
  agentRuntime: {
    sessionMessageRequest:
      createTypedKey<AgentRuntimeSessionMessageIngressPayload>(
        "agent-runtime.session-message.request",
      ),
  },
} as const;
