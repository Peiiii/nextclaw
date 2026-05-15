import type { NcpEndpointEvent } from "@nextclaw/ncp";

export type FeishuDomain = "feishu" | "lark";

export type FeishuAccountConfig = {
  enabled?: boolean;
  name?: string;
  domain?: FeishuDomain;
  allowFrom?: string[];
  groupPolicy?: "open" | "allowlist" | "disabled";
  requireMention?: boolean;
};

export type FeishuChannelConfig = {
  enabled?: boolean;
  defaultAccountId?: string;
  domain?: FeishuDomain;
  allowFrom?: string[];
  groupPolicy?: "open" | "allowlist" | "disabled";
  requireMention?: boolean;
  accounts?: Record<string, FeishuAccountConfig>;
};

export type FeishuInboundMessage = {
  conversationId: string;
  senderId: string;
  text: string;
  accountId: string;
  peerKind: "direct" | "group";
  messageId?: string;
  raw?: unknown;
};

export type FeishuRuntimeAccount = {
  accountId: string;
  appId: string;
  appSecret: string;
  domain: FeishuDomain;
  enabled: boolean;
  name?: string;
  botOpenId?: string;
  allowFrom: string[];
  groupPolicy: "open" | "allowlist" | "disabled";
  requireMention: boolean;
};

export type FeishuChannelAdapterContract = {
  configure: (config: FeishuChannelConfig) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onMessage: (handler: (message: FeishuInboundMessage) => void | Promise<void>) => () => void;
  sendNcpEvent: (event: NcpEndpointEvent) => Promise<void>;
};
