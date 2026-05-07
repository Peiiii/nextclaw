import type { Config } from "../config/schema.js";
import type { MessageBus } from "../bus/queue.js";
import type { SessionManager } from "../session/manager.js";
import type { BaseChannel } from "../channels/base.js";

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
  nextclaw?: {
    isEnabled?: (cfg: Config) => boolean;
    createChannel?: (ctx: {
      config: Config;
      bus: MessageBus;
      sessionManager?: SessionManager;
    }) => BaseChannel<Record<string, unknown>>;
  };
  outbound?: {
    sendText?: (ctx: {
      cfg: Config;
      to: string;
      text: string;
      accountId?: string | null;
    }) => Promise<unknown> | unknown;
    sendPayload?: (ctx: {
      cfg: Config;
      to: string;
      text: string;
      payload: unknown;
      accountId?: string | null;
    }) => Promise<unknown> | unknown;
  };
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
