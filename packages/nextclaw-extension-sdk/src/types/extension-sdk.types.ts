import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type {
  ExtensionChannelCommandExecuteResponse,
  ExtensionChannelCommandSpec,
  ExtensionChannelMessageSubmitIngressPayload,
  Unsubscribe,
} from "@nextclaw/shared";
export type {
  ExtensionChannelConfigGetIngressPayload as ChannelConfigGetRequest,
  ExtensionChannelCommandExecuteIngressPayload as ChannelCommandExecuteRequest,
  ExtensionChannelCommandExecuteResponse as ChannelCommandExecuteResponse,
  ExtensionChannelCommandListIngressPayload as ChannelCommandListRequest,
  ExtensionChannelCommandListResponse as ChannelCommandListResponse,
  ExtensionChannelCommandOption as ChannelCommandOption,
  ExtensionChannelCommandOptionType as ChannelCommandOptionType,
  ExtensionChannelCommandSpec as ChannelCommandSpec,
  ExtensionChannelFileContent as ChannelFileContent,
  ExtensionChannelImageContent as ChannelImageContent,
  ExtensionChannelMessageContent as ChannelMessageContent,
  ExtensionChannelMessageSubmitIngressPayload as ChannelSubmittedMessage,
  ExtensionChannelSubmittedAttachment as ChannelSubmittedAttachment,
  ExtensionChannelTextContent as ChannelTextContent,
  ExtensionResponseIngressPayload as ExtensionRequestResponse,
} from "@nextclaw/shared";

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

export type ChannelConfigGetResponse<TConfig = unknown> = {
  config: TConfig;
};

export type ExtensionChannelConfig = {
  get: <TConfig = unknown>() => Promise<TConfig>;
  onChange: <TConfig = unknown>(
    handler: (config: TConfig) => void | Promise<void>,
  ) => Unsubscribe;
};

export type ExtensionChannelCommands = {
  list: () => Promise<ExtensionChannelCommandSpec[]>;
  execute: (input: {
    commandName: string;
    args?: Record<string, unknown>;
    conversationId: string;
    senderId: string;
    metadata?: Record<string, unknown>;
  }) => Promise<ExtensionChannelCommandExecuteResponse>;
  executeText: (input: {
    rawText: string;
    conversationId: string;
    senderId: string;
    metadata?: Record<string, unknown>;
  }) => Promise<ExtensionChannelCommandExecuteResponse | null>;
};

export type ExtensionChannel = {
  id: string;
  submitMessage: (input: Omit<ExtensionChannelMessageSubmitIngressPayload, "channelId">) => Promise<void>;
  onNcpEvent: (handler: (event: NcpEndpointEvent) => void | Promise<void>) => Unsubscribe;
  config: ExtensionChannelConfig;
  commands: ExtensionChannelCommands;
};

export type ExtensionChannels = {
  use: (channelId: string) => ExtensionChannel;
};

export type ExtensionRequestHandler = (request: ExtensionRequest) => unknown | Promise<unknown>;

export type ExtensionCapabilityPayload = Record<string, unknown>;

export type ExtensionCapabilityHandler<TPayload extends ExtensionCapabilityPayload = ExtensionCapabilityPayload> = (
  payload: TPayload,
  request: ExtensionRequest,
) => unknown | Promise<unknown>;

export type ExtensionCapabilities = {
  provide: (namespace: string, capability: object) => Unsubscribe;
  provideHandler: (kind: string, handler: ExtensionCapabilityHandler) => Unsubscribe;
};
