import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type { ChannelSubmittedAttachment } from "@nextclaw/extension-sdk";

export type WeixinAccountConfig = {
  enabled?: boolean;
  baseUrl?: string;
  userId?: string;
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
  attachments?: ChannelSubmittedAttachment[];
  accountId?: string;
  contextToken?: string;
  raw?: unknown;
};

export type WeixinRuntimeAccount = {
  accountId: string;
  token: string;
  enabled: boolean;
  baseUrl: string;
  pollTimeoutMs: number;
  allowFrom: string[];
};

export type WeixinChannelAdapter = {
  configure: (config: WeixinChannelConfig) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onMessage: (handler: (message: WeixinInboundMessage) => void | Promise<void>) => () => void;
  sendNcpEvent: (event: NcpEndpointEvent) => Promise<void>;
  sendOutboundText: (params: {
    to: string;
    text: string;
    accountId?: string | null;
  }) => Promise<void>;
};
