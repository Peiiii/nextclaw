export const DESKTOP_HOST_PROTOCOL_VERSION = 1 as const;

export const DESKTOP_HOST_ACCESS = [
  "ui.read",
  "ui.observe",
  "ui.write",
  "screen.capture-window",
  "input.keyboard",
  "input.pointer",
] as const;

export type DesktopHostAccess = typeof DESKTOP_HOST_ACCESS[number];

export type DesktopApplicationTarget = {
  applicationId: string;
};

export type ResolvedDesktopApplicationTarget =
  | { platform: "darwin"; applicationId: string; bundleId: string }
  | {
      platform: "win32";
      applicationId: string;
      appUserModelId?: string;
      executableIdentity?: string;
    }
  | {
      platform: "linux";
      applicationId: string;
      desktopFileId?: string;
      executableIdentity?: string;
    };

export type DesktopHostCaller = {
  extensionId?: string;
  agentId?: string;
  sessionId?: string;
  agentRunId?: string;
  subscriptionId?: string;
};

export type DesktopHostMethod =
  | "host.hello"
  | "host.status"
  | "host.application.resolve"
  | "host.permissions.get"
  | "host.permissions.request"
  | "host.permissions.openSettings"
  | "host.ui.snapshot"
  | "host.ui.action"
  | "host.ui.observe"
  | "host.ui.unobserve"
  | "host.screen.captureWindow"
  | "host.input.click"
  | "host.input.typeText"
  | "host.input.pressKey";

export type DesktopHostRequest = {
  protocolVersion: typeof DESKTOP_HOST_PROTOCOL_VERSION;
  requestId: string;
  token: string;
  method: DesktopHostMethod;
  caller: DesktopHostCaller;
  payload: unknown;
};

export type DesktopHostResponse = {
  protocolVersion: typeof DESKTOP_HOST_PROTOCOL_VERSION;
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: DesktopCapabilityError;
};

export type DesktopHostEvent = {
  protocolVersion: typeof DESKTOP_HOST_PROTOCOL_VERSION;
  type: "host.event";
  watchId: string;
  event: unknown;
};

export type DesktopHostStatus = {
  online: boolean;
  platform?: NodeJS.Platform;
  protocolVersion?: number;
  supportedAccess: DesktopHostAccess[];
  supportedOperations: DesktopHostMethod[];
  permissions: {
    accessibility: "granted" | "not_granted" | "not_supported" | "unknown";
    screenCapture: "granted" | "not_granted" | "not_supported" | "unknown";
  };
};

export type DesktopCapabilityErrorCode =
  | "desktop_host_unavailable"
  | "desktop_host_protocol_mismatch"
  | "unsupported_platform"
  | "permission_not_granted"
  | "capability_not_declared"
  | "authorization_required"
  | "authorization_denied"
  | "target_not_running"
  | "window_not_found"
  | "element_not_found"
  | "stale_target"
  | "operation_not_supported"
  | "payload_limit_exceeded"
  | "host_operation_failed";

export type DesktopCapabilityError = {
  code: DesktopCapabilityErrorCode;
  message: string;
  recovery?: {
    action:
      | "open_settings"
      | "start_desktop"
      | "show_authorization"
      | "refresh_target"
      | "update_desktop";
  };
  request?: unknown;
};

export type DesktopHostCapabilityDeclaration = {
  access: DesktopHostAccess[];
};

export type DesktopHostManifest = {
  id: string;
  contributes?: {
    hostCapabilities?: {
      desktopAutomation?: DesktopHostCapabilityDeclaration;
    };
  };
};
