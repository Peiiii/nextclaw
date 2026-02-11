// API Types - matching backend response format
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
};

export type ProviderConfigUpdate = {
  apiKey?: string | null;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
};

export type ChannelConfigUpdate = Record<string, unknown>;

export type UiConfigView = {
  enabled: boolean;
  host: string;
  port: number;
  open: boolean;
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
  ui?: UiConfigView;
};

export type ProviderSpecView = {
  name: string;
  displayName?: string;
  keywords: string[];
  envKey: string;
  isGateway?: boolean;
  isLocal?: boolean;
  defaultApiBase?: string;
};

export type ChannelSpecView = {
  name: string;
  displayName?: string;
  enabled: boolean;
};

export type ConfigMetaView = {
  providers: ProviderSpecView[];
  channels: ChannelSpecView[];
};

// WebSocket events
export type WsEvent =
  | { type: 'config.updated'; payload: { path: string } }
  | { type: 'config.reload.started'; payload?: Record<string, unknown> }
  | { type: 'config.reload.finished'; payload?: Record<string, unknown> }
  | { type: 'error'; payload: { message: string; code?: string } }
  | { type: 'connection.open'; payload?: Record<string, unknown> };
