export type AigenMediaKind = "image" | "video" | "audio";

export type AigenModelCapabilities = {
  generate?: boolean;
  edit?: boolean;
  maxCount?: number;
  sizes?: string[];
  outputFormats?: string[];
  qualities?: string[];
  supportsTransparentBackground?: boolean;
};

export type AigenModelConfig = {
  kind: AigenMediaKind;
  displayName?: string;
  capabilities?: AigenModelCapabilities;
};

export type AigenProviderConfig = {
  apiFormat: string;
  displayName?: string;
  apiBase: string;
  apiKeyRef: string;
  headers?: Record<string, string>;
  models: Record<string, AigenModelConfig>;
};

export type AigenConfig = {
  version: 1;
  providers: Record<string, AigenProviderConfig>;
};

export const createEmptyAigenConfig = (): AigenConfig => ({
  version: 1,
  providers: {}
});
