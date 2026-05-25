import type * as NextclawCore from "@nextclaw/core";
import type { EventBus, Ingress } from "@nextclaw/shared";
import type { ChildProcess } from "node:child_process";
import type {
  ExtensionChannelBinding,
  ExtensionUiMetadata,
} from "@nextclaw/core";

export type Config = NextclawCore.Config;
export type InboundAttachment = NextclawCore.InboundAttachment;
export type InboundMessage = NextclawCore.InboundMessage;
export type MessageBus = NextclawCore.MessageBus;
export type SessionManager = NextclawCore.SessionManager;

export type ExtensionServerConfig = {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type ExtensionManifest = {
  id: string;
  name?: string;
  version?: string;
  rootDir: string;
  server: ExtensionServerConfig;
  contributes?: {
    channels?: Array<{
      id: string;
      name?: string;
      description?: string;
      meta?: Record<string, unknown>;
      configSchema?: Record<string, unknown>;
      configUiHints?: Record<string, Record<string, unknown>>;
      auth?: boolean | Record<string, unknown>;
      outbound?: {
        text?: boolean;
      };
    }>;
  };
};

export type ExtensionRuntimeContributions = {
  channelBindings: ExtensionChannelBinding[];
  uiMetadata: ExtensionUiMetadata[];
};

export type RunningExtensionProcess = {
  manifest: ExtensionManifest;
  process: ChildProcess;
};

export type PendingExtensionRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export type ExtensionChannelRequestKind =
  | "channel.auth.login"
  | "channel.auth.start"
  | "channel.auth.poll"
  | "channel.outbound.sendText";

export type ExtensionRequestSender = <T>(params: {
  extensionId: string;
  kind: ExtensionChannelRequestKind;
  payload: Record<string, unknown>;
}) => Promise<T>;

export type ExtensionRuntimeServiceOptions = {
  eventBus: Pick<EventBus, "emitEnvelope">;
  getConfig: () => Config;
  getWorkspace: () => string;
  ingress: Pick<Ingress, "addHandler">;
  messageBus: Pick<MessageBus, "publishInbound">;
  sessionManager: SessionManager;
};
