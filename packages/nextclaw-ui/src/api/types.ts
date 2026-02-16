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
  wireApi?: "auto" | "chat" | "responses" | null;
};

export type ProviderConfigUpdate = {
  apiKey?: string | null;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
};

export type ChannelConfigUpdate = Record<string, unknown>;

export type ConfigView = {
  agents: {
    defaults: {
      model: string;
      workspace?: string;
      maxTokens?: number;
      temperature?: number;
      maxToolIterations?: number;
    };
    context?: {
      bootstrap?: {
        files?: string[];
        minimalFiles?: string[];
        heartbeatFiles?: string[];
        perFileChars?: number;
        totalChars?: number;
      };
      memory?: {
        enabled?: boolean;
        maxChars?: number;
      };
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

export type ConfigUiHint = {
  label?: string;
  help?: string;
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
};

export type ConfigUiHints = Record<string, ConfigUiHint>;

export type ConfigSchemaResponse = {
  schema: Record<string, unknown>;
  uiHints: ConfigUiHints;
  version: string;
  generatedAt: string;
};

export type FeishuProbeView = {
  appId: string;
  botName?: string | null;
  botOpenId?: string | null;
};

// WebSocket events
export type WsEvent =
  | { type: 'config.updated'; payload: { path: string } }
  | { type: 'config.reload.started'; payload?: Record<string, unknown> }
  | { type: 'config.reload.finished'; payload?: Record<string, unknown> }
  | { type: 'error'; payload: { message: string; code?: string } }
  | { type: 'connection.open'; payload?: Record<string, unknown> };
