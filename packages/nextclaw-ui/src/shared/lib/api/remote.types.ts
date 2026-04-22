export type RemoteAccountView = {
  loggedIn: boolean;
  email?: string;
  username?: string | null;
  role?: string;
  platformBase?: string | null;
  apiBase?: string | null;
};

export type RemoteAccountProfileUpdateRequest = {
  username: string;
};

export type RemoteRuntimeView = {
  enabled: boolean;
  mode: "service" | "foreground";
  state: "disabled" | "connecting" | "connected" | "disconnected" | "error";
  deviceId?: string;
  deviceName?: string;
  platformBase?: string;
  localOrigin?: string;
  lastConnectedAt?: string | null;
  lastError?: string | null;
  updatedAt: string;
};

export type RemoteServiceView = {
  running: boolean;
  pid?: number;
  uiUrl?: string;
  uiPort?: number;
  currentProcess: boolean;
};

export type RemoteSettingsView = {
  enabled: boolean;
  deviceName: string;
  platformApiBase: string;
};

export type RemoteAccessView = {
  account: RemoteAccountView;
  settings: RemoteSettingsView;
  service: RemoteServiceView;
  localOrigin: string;
  configuredEnabled: boolean;
  platformBase?: string | null;
  runtime: RemoteRuntimeView | null;
};

export type RemoteDoctorCheckView = {
  name: string;
  ok: boolean;
  detail: string;
};

export type RemoteDoctorView = {
  generatedAt: string;
  checks: RemoteDoctorCheckView[];
  snapshot: {
    configuredEnabled: boolean;
    runtime: RemoteRuntimeView | null;
  };
};

export type RemoteLoginRequest = {
  email: string;
  password: string;
  apiBase?: string;
};

export type RemoteBrowserAuthStartRequest = {
  apiBase?: string;
};

export type RemoteBrowserAuthStartResult = {
  sessionId: string;
  verificationUri: string;
  expiresAt: string;
  intervalMs: number;
};

export type RemoteBrowserAuthPollRequest = {
  sessionId: string;
  apiBase?: string;
};

export type RemoteBrowserAuthPollResult = {
  status: "pending" | "authorized" | "expired";
  message?: string;
  nextPollMs?: number;
  email?: string;
  role?: string;
};

export type RemoteSettingsUpdateRequest = {
  enabled?: boolean;
  deviceName?: string;
  platformApiBase?: string;
};

export type RemoteServiceAction = "start" | "restart" | "stop";

export type RemoteServiceActionResult = {
  accepted: boolean;
  action: RemoteServiceAction;
  message: string;
};
