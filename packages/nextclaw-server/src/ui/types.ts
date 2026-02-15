export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export type ProviderConfigView = {
  apiKeySet: boolean;
  apiKeyMasked?: string;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
};

export type ProviderConfigUpdate = {
  apiKey?: string | null;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
};

export type ConfigView = {
  agents: {
    defaults: {
      model: string;
      workspace?: string;
      maxTokens?: number;
      temperature?: number;
      maxToolIterations?: number;
    };
  };
  providers: Record<string, ProviderConfigView>;
  channels: Record<string, Record<string, unknown>>;
  tools?: Record<string, unknown>;
  gateway?: Record<string, unknown>;
};

export type ProviderSpecView = {
  name: string;
  displayName?: string;
  keywords: string[];
  envKey: string;
  isGateway?: boolean;
  isLocal?: boolean;
  defaultApiBase?: string;
  supportsWireApi?: boolean;
  wireApiOptions?: Array<"auto" | "chat" | "responses">;
  defaultWireApi?: "auto" | "chat" | "responses";
};

export type ChannelSpecView = {
  name: string;
  displayName?: string;
  enabled: boolean;
  tutorialUrl?: string;
};

export type ConfigMetaView = {
  providers: ProviderSpecView[];
  channels: ChannelSpecView[];
};

export type UiServerEvent =
  | { type: "config.updated"; payload: { path: string } }
  | { type: "config.reload.started"; payload?: Record<string, unknown> }
  | { type: "config.reload.finished"; payload?: Record<string, unknown> }
  | { type: "error"; payload: { message: string; code?: string } };

export type UiServerOptions = {
  host: string;
  port: number;
  configPath: string;
  corsOrigins?: string[] | "*";
  staticDir?: string;
};

export type UiServerHandle = {
  host: string;
  port: number;
  close: () => Promise<void>;
  publish: (event: UiServerEvent) => void;
};
