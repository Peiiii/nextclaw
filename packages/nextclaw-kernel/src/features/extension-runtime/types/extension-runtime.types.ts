import type * as NextclawCore from "@nextclaw/core";
import type { EventBus, Ingress } from "@nextclaw/shared";
import type { ChildProcess } from "node:child_process";
import type {
  ExtensionChannelBinding,
  ExtensionUiMetadata,
} from "@nextclaw/core";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { DesktopHost } from "@kernel/features/desktop-host/index.js";
import type { CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import type {
  ObservationEvent,
  ObservationExtensionRuntime,
} from "@kernel/features/observation/index.js";

export type Config = NextclawCore.Config;
export type InboundAttachment = NextclawCore.InboundAttachment;
export type InboundMessage = NextclawCore.InboundMessage;
export type MessageBus = NextclawCore.MessageBus;

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
    observations?: {
      read?: { description: string; configSchema?: Record<string, unknown> };
      events?: {
        description: string;
        configSchema?: Record<string, unknown>;
        replay?: "supported" | "unsupported";
      };
    };
    hostCapabilities?: {
      desktopAutomation?: {
        access: Array<
          | "ui.read"
          | "ui.observe"
          | "ui.write"
          | "screen.capture-window"
          | "input.keyboard"
          | "input.pointer"
        >;
      };
    };
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
  generation: string;
};

export type ExtensionProcessState =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "failed";

export type ExtensionLeaseReason =
  | { kind: "enabled-channel"; channelId: string }
  | { kind: "auth-session"; sessionId: string; expiresAt: string }
  | { kind: "auth-handoff"; channelId: string; expiresAt: string }
  | { kind: "request"; requestId: string }
  | { kind: "observation-subscription"; subscriptionId: string };

export type ExtensionLease = {
  extensionId: string;
  generation: string;
  id: string;
  reason: ExtensionLeaseReason;
  release: () => void;
};

export type ExtensionRuntimeStatus = {
  extensionId: string;
  generation: string | null;
  lastExit: {
    at: string;
    code: number | null;
    expected: boolean;
    signal: string | null;
  } | null;
  leaseReasons: ExtensionLeaseReason[];
  memory: {
    pssBytes: number | null;
    rssBytes: number | null;
  } | null;
  pid: number | null;
  startedAt: string | null;
  state: ExtensionProcessState;
  startupDurationMs: number | null;
};

export type ExtensionProcessExitEvent = {
  extensionId: string;
  generation: string;
  expected: boolean;
};

export type PendingExtensionRequest = {
  extensionId: string;
  generation: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  cleanup: () => void;
};

export type ExtensionObservationRequestKind =
  | "observation.read"
  | "observation.subscribe"
  | "observation.unsubscribe";

export type ExtensionChannelRequestKind =
  | "channel.auth.login"
  | "channel.auth.start"
  | "channel.auth.connect"
  | "channel.auth.poll"
  | "channel.outbound.sendText";

export type ExtensionRequestSender = <T>(params: {
  extensionId: string;
  kind: ExtensionChannelRequestKind | ExtensionObservationRequestKind;
  payload: Record<string, unknown>;
}) => Promise<T>;

export type ExtensionRuntimeServiceOptions = {
  diagnostics: NextclawCore.DiagnosticRuntime;
  capabilityGrantManager: CapabilityGrantManager;
  desktopHost: DesktopHost;
  eventBus: Pick<EventBus, "emitEnvelope">;
  getConfig: () => Config;
  getWorkspace: () => string;
  hasAgent?: (agentId: string) => boolean;
  ingress: Pick<Ingress, "addHandler">;
  messageBus: Pick<MessageBus, "publishInbound">;
  sessionManager: SessionManager;
  onObservationEvent?: (input: {
    extensionId: string;
    subscriptionId: string;
    event: ObservationEvent;
  }) => Promise<{ accepted: boolean }>;
  onObservationRuntimeExited?: (extensionId: string) => void;
  onObservationRuntimeReady?: (extensionId: string) => Promise<void>;
  onDesktopObservationAuthorizationRevoked?: (input: {
    extensionId: string;
    subscriptionId: string;
  }) => Promise<void>;
  onDesktopObservationAuthorizationGranted?: (input: {
    extensionId: string;
  }) => Promise<void>;
};

export type ExtensionObservationRuntime = ObservationExtensionRuntime;
