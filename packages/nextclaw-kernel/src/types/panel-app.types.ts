import type {
  NcpEndpointEvent,
  NcpMessage,
  NcpMessagePart,
  NcpRunHandle,
} from "@nextclaw/ncp";
import type { AgentRunSendIngressPayload } from "@nextclaw/shared";
import type { ServiceActionCaller } from "@kernel/types/service-app.types.js";

export type PanelAppEntry = {
  id: string;
  appId: string;
  fileName: string;
  kind: "single-file" | "folder";
  title: string;
  description?: string;
  icon?: string;
  contentPath: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  favorite: boolean;
  mainSidebar: boolean;
  mainSidebarOrder?: number;
  clientDeclared: boolean;
  clientGranted: boolean;
  lastOpenedAt?: string;
  openCount: number;
  sourceKind: "workspace" | "package";
  packageId?: string;
  packageVersion?: string;
};

export type PanelAppList = {
  workspacePath: string;
  panelsPath: string;
  entries: PanelAppEntry[];
  unavailablePackages: Array<{ appId: string; message: string }>;
};

export type PanelAppContent = {
  id: string;
  appId: string;
  fileName: string;
  html: string;
  contentType: "text/html; charset=utf-8";
  capabilities: string[];
  clientDeclared: boolean;
  clientGranted: boolean;
  serviceActions: string[];
};

export type PanelAppDeleteResult = {
  deleted: true;
  fileName: string;
  id: string;
};

export type PanelAppBridgeSession = {
  id: string;
  token: string;
  appId: string;
  caller: ServiceActionCaller;
  declaredCapabilities: string[];
  declaredActions: string[];
  clientDeclared: boolean;
  createdAt: string;
  expiresAt: string;
};

export type PanelAppErrorCode =
  | "AGENT_OBJECT_REQUEST_FAILED"
  | "AGENT_OBJECT_RESULT_NOT_SUBMITTED"
  | "AGENT_OBJECT_RESULT_SCHEMA_INVALID"
  | "AGENT_OBJECT_RESULT_TIMEOUT"
  | "AUTHORIZATION_REQUIRED"
  | "PANEL_APP_AGENT_REQUEST_INVALID"
  | "PANEL_APP_ASSET_TOKEN_EXPIRED"
  | "PANEL_APP_ASSET_TOKEN_INVALID"
  | "PANEL_APP_BRIDGE_SESSION_NOT_FOUND"
  | "PANEL_APP_CAPABILITY_NOT_DECLARED"
  | "PANEL_APP_CLIENT_NOT_DECLARED"
  | "PANEL_APP_INVALID_ASSET_PATH"
  | "PANEL_APP_INVALID_ID"
  | "PANEL_APP_INVALID_SOURCE_PATH"
  | "PANEL_APP_MANIFEST_INVALID"
  | "PANEL_APP_MANAGED_SOURCE"
  | "PANEL_APP_NOT_FOUND"
  | "PANEL_APP_READ_FAILED";

export class PanelAppError extends Error {
  constructor(
    readonly code: PanelAppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PanelAppError";
  }
}

export function isPanelAppError(error: unknown): error is PanelAppError {
  return error instanceof PanelAppError;
}

export const PANEL_APP_AGENT_CAPABILITIES = [
  "agent:send",
  "agent:generateObject",
] as const;

export type PanelAppAgentCapability = typeof PANEL_APP_AGENT_CAPABILITIES[number];

export function isPanelAppAgentCapability(
  value: unknown,
): value is PanelAppAgentCapability {
  return (PANEL_APP_AGENT_CAPABILITIES as readonly unknown[]).includes(value);
}

export type PanelAppCapabilityGrantCaller = {
  surface: "panel-app";
  appId: string;
};

export type PanelAppCapabilityGrant = {
  caller: PanelAppCapabilityGrantCaller;
  capability: PanelAppAgentCapability;
  grantedAt: string;
};

export type PanelAppAgentSendPayload =
  | {
      sessionId?: string;
      peerId?: string;
      content: NcpMessagePart[];
      message?: never;
      metadata?: Record<string, unknown>;
    }
  | {
      sessionId?: string;
      peerId?: string;
      message: NcpMessage | (Omit<NcpMessage, "sessionId"> & { sessionId?: string });
      content?: never;
      metadata?: Record<string, unknown>;
    };

export type PanelAppAgentSendRequest = {
  payload: PanelAppAgentSendPayload;
};

export type PanelAppAgentSendResult = NcpRunHandle;

export type PanelAppAgentRunClient = {
  send: (input: AgentRunSendIngressPayload) => Promise<NcpRunHandle>;
  sendAndStreamEvents: (
    input: AgentRunSendIngressPayload,
  ) => AsyncGenerator<NcpEndpointEvent>;
};

export type PanelAppAgentGenerateObjectInput = {
  peerId: string;
  prompt: string;
  context?: unknown;
  schema: Record<string, unknown>;
  title?: string;
  timeoutMs?: number;
};

export type PanelAppAgentGenerateObjectRequest = {
  input: PanelAppAgentGenerateObjectInput;
};

export type PanelAppAgentGenerateObjectResult = {
  result: unknown;
};
