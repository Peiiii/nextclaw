import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type { Unsubscribe } from "@nextclaw/shared";

export type NextClawExtensionOptions = {
  endpoint?: string;
  token?: string;
  extensionId?: string;
  fetch?: typeof fetch;
  webSocketFactory?: (url: string) => NextClawExtensionWebSocketLike;
};

export type NextClawExtensionWebSocketLike = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: (() => void) | null;
  close: () => void;
};

export type ExtensionTransportEnvelope<TPayload = unknown> = {
  type: string;
  extensionId: string;
  payload: TPayload;
  emittedAt?: string;
  source?: string;
};

export type ExtensionRequest = {
  requestId: string;
  extensionId: string;
  kind: string;
  payload?: Record<string, unknown>;
};

export type ExtensionRequestResponse =
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

export type ChannelTextContent = {
  type: "text";
  text: string;
};

export type ChannelImageContent = {
  type: "image";
  url?: string;
  assetUri?: string;
  mimeType?: string;
  name?: string;
};

export type ChannelFileContent = {
  type: "file";
  url?: string;
  assetUri?: string;
  mimeType?: string;
  name?: string;
};

export type ChannelMessageContent =
  | ChannelTextContent
  | ChannelImageContent
  | ChannelFileContent;

export type ChannelSubmittedAttachment = {
  id?: string;
  name?: string;
  path?: string;
  url?: string;
  assetUri?: string;
  mimeType?: string;
  size?: number;
  source?: string;
  status?: "ready" | "remote-only";
  errorCode?: "too_large" | "download_failed" | "http_error" | "invalid_payload";
};

export type ChannelSubmittedMessage = {
  channelId: string;
  conversationId: string;
  senderId: string;
  content: ChannelMessageContent;
  attachments?: ChannelSubmittedAttachment[];
  metadata?: Record<string, unknown>;
};

export type ChannelConfigGetRequest = {
  channelId: string;
};

export type ChannelConfigGetResponse<TConfig = unknown> = {
  config: TConfig;
};

export type ExtensionChannelConfig = {
  get: <TConfig = unknown>() => Promise<TConfig>;
  onChange: <TConfig = unknown>(
    handler: (config: TConfig) => void | Promise<void>,
  ) => Unsubscribe;
};

export type ExtensionChannel = {
  id: string;
  submitMessage: (input: Omit<ChannelSubmittedMessage, "channelId">) => Promise<void>;
  onNcpEvent: (handler: (event: NcpEndpointEvent) => void | Promise<void>) => Unsubscribe;
  config: ExtensionChannelConfig;
};

export type ExtensionChannels = {
  use: (channelId: string) => ExtensionChannel;
};

export type ExtensionRequestHandler = (request: ExtensionRequest) => unknown | Promise<unknown>;
