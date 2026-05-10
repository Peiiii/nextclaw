import type { EventBus, Unsubscribe } from "@nextclaw/shared";

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

export type ChannelSubmittedMessage = {
  channelId: string;
  conversationId: string;
  senderId: string;
  content: ChannelMessageContent;
  metadata?: Record<string, unknown>;
};

export type ChannelConfigGetRequest = {
  channelId: string;
};

export type ChannelConfigGetResponse<TConfig = unknown> = {
  config: TConfig;
};

export type ChannelConfigChangedEvent<TConfig = unknown> = {
  extensionId?: string;
  channelId: string;
  config: TConfig;
};

export type ChannelNcpEvent<TEvent = unknown> = {
  extensionId?: string;
  channelId: string;
  event: TEvent;
};

export type ExtensionChannelConfigService = {
  get: <TConfig = unknown>() => Promise<TConfig>;
  onChange: <TConfig = unknown>(
    handler: (config: TConfig, event: ChannelConfigChangedEvent<TConfig>) => void | Promise<void>,
  ) => Unsubscribe;
};

export type ExtensionChannel = {
  id: string;
  submitMessage: (input: Omit<ChannelSubmittedMessage, "channelId">) => Promise<void>;
  onNcpEvent: <TEvent = unknown>(
    handler: (event: TEvent, envelope: ChannelNcpEvent<TEvent>) => void | Promise<void>,
  ) => Unsubscribe;
  config: ExtensionChannelConfigService;
};

export type ExtensionChannelsService = {
  use: (channelId: string) => ExtensionChannel;
};

export type NextClawExtension = {
  extensionId: string;
  eventBus: EventBus;
  channels: ExtensionChannelsService;
  close: () => void;
};
