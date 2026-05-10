import type { NcpEndpointEvent } from "@nextclaw/ncp";

export type WeixinAccountConfig = {
  enabled?: boolean;
  baseUrl?: string;
  allowFrom?: string[];
};

export type WeixinChannelConfig = {
  enabled?: boolean;
  defaultAccountId?: string;
  baseUrl?: string;
  pollTimeoutMs?: number;
  allowFrom?: string[];
  accounts?: Record<string, WeixinAccountConfig>;
};

export type WeixinInboundMessage = {
  conversationId: string;
  senderId: string;
  text: string;
  accountId?: string;
  raw?: unknown;
};

export type WeixinChannelAdapter = {
  configure: (config: WeixinChannelConfig) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onMessage: (handler: (message: WeixinInboundMessage) => void | Promise<void>) => () => void;
  sendNcpEvent: (event: NcpEndpointEvent) => Promise<void>;
};
