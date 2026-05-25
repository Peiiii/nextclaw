import type { Config } from "@core/features/config/index.js";

export type ExtensionDiagnostic = {
  level: "warn" | "error";
  message: string;
  extensionId?: string;
  source?: string;
};

export type ExtensionTool = {
  label?: string;
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  execute:
    | ((toolCallId: string, params: Record<string, unknown>) => Promise<unknown> | unknown)
    | ((params: Record<string, unknown>) => Promise<unknown> | unknown);
};

export type ExtensionToolContext = {
  config?: Config;
  workspaceDir?: string;
  sessionKey?: string;
  channel?: string;
  chatId?: string;
  sandboxed?: boolean;
};

export type ExtensionToolFactory = (
  ctx: ExtensionToolContext
) => ExtensionTool | ExtensionTool[] | null | undefined;

export type ExtensionToolRegistration = {
  extensionId: string;
  factory: ExtensionToolFactory;
  names: string[];
  optional: boolean;
  source: string;
};

export type ExtensionChannel = {
  id: string;
  meta?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  configSchema?: ExtensionChannelConfigSchema;
  auth?: ExtensionChannelAuth;
  outbound?: {
    sendText?: (ctx: {
      cfg: Config;
      to: string;
      text: string;
      accountId?: string | null;
      replyTo?: string | null;
      media?: string[];
      metadata?: Record<string, unknown>;
    }) => Promise<unknown> | unknown;
    sendPayload?: (ctx: {
      cfg: Config;
      to: string;
      text: string;
      payload: unknown;
      accountId?: string | null;
      replyTo?: string | null;
      media?: string[];
      metadata?: Record<string, unknown>;
    }) => Promise<unknown> | unknown;
  };
};

export type ExtensionChannelConfigUiHint = {
  label?: string;
  help?: string;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
};

export type ExtensionChannelConfigSchema = {
  schema: Record<string, unknown>;
  uiHints?: Record<string, ExtensionChannelConfigUiHint>;
};

export type ExtensionChannelAuthLoginResult = {
  channelConfig: Record<string, unknown>;
  accountId?: string | null;
  notes?: string[];
};

export type ExtensionChannelAuthStartResult = {
  channel: string;
  kind: "qr_code";
  sessionId: string;
  qrCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  intervalMs: number;
  note?: string;
};

export type ExtensionChannelAuthPollResult = {
  channel: string;
  status: "pending" | "scanned" | "authorized" | "expired" | "error";
  message?: string;
  nextPollMs?: number;
  accountId?: string | null;
  notes?: string[];
  channelConfig?: Record<string, unknown>;
};

export type ExtensionChannelAuthConnectResult = ExtensionChannelAuthPollResult;

export type ExtensionChannelAuth = {
  login?: (params: {
    cfg: Config;
    extensionId: string;
    channelId: string;
    channelConfig?: Record<string, unknown>;
    accountId?: string | null;
    baseUrl?: string | null;
    verbose?: boolean;
  }) => Promise<ExtensionChannelAuthLoginResult> | ExtensionChannelAuthLoginResult;
  start?: (params: {
    cfg: Config;
    extensionId: string;
    channelId: string;
    channelConfig?: Record<string, unknown>;
    accountId?: string | null;
    baseUrl?: string | null;
    domain?: string | null;
  }) => Promise<ExtensionChannelAuthStartResult> | ExtensionChannelAuthStartResult;
  connect?: (params: {
    cfg: Config;
    extensionId: string;
    channelId: string;
    channelConfig?: Record<string, unknown>;
    accountId?: string | null;
    domain?: string | null;
    fields?: Record<string, unknown>;
  }) => Promise<ExtensionChannelAuthConnectResult> | ExtensionChannelAuthConnectResult;
  poll?: (params: {
    cfg: Config;
    extensionId: string;
    channelId: string;
    channelConfig?: Record<string, unknown>;
    sessionId: string;
  }) =>
    | Promise<ExtensionChannelAuthPollResult | null>
    | ExtensionChannelAuthPollResult
    | null;
};

export type ExtensionChannelBinding = {
  extensionId: string;
  channelId: string;
  channel: ExtensionChannel;
};

export type ExtensionUiMetadata = {
  id: string;
  configSchema?: Record<string, unknown>;
  configUiHints?: Record<string, ExtensionChannelConfigUiHint>;
};

export type ExtensionChannelRegistration = {
  extensionId: string;
  channel: ExtensionChannel;
  source: string;
};

export type ExtensionRegistry = {
  tools: ExtensionToolRegistration[];
  channels: ExtensionChannelRegistration[];
  diagnostics: ExtensionDiagnostic[];
};
