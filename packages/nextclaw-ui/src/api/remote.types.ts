export type RemoteAccountView = {
  loggedIn: boolean;
  email?: string;
  role?: string;
  platformBase?: string | null;
  apiBase?: string | null;
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
  register?: boolean;
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
