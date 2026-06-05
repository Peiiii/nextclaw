import type { AigenMediaKind } from "./config.types.js";

export type AigenProviderContext = {
  providerId: string;
  apiFormat: string;
  apiBase: string;
  apiKey: string;
  headers?: Record<string, string>;
};

export type AigenProviderImageRequest = {
  providerLocalModel: string;
  prompt: string;
  size?: string;
  n: number;
  quality?: string;
  background?: string;
  outputFormat?: string;
  outputCompression?: number;
  moderation?: string;
};

export type AigenProviderImage = {
  bytes: Uint8Array;
  mimeType: string;
  format?: string;
  width?: number;
  height?: number;
  revisedPrompt?: string;
};

export type AigenProviderImageResult = {
  images: AigenProviderImage[];
  usage?: Record<string, unknown>;
  upstreamRequestId?: string;
  metadata?: Record<string, unknown>;
};

export interface AigenImageProvider {
  readonly apiFormat: string;

  generateImage(
    request: AigenProviderImageRequest,
    context: AigenProviderContext,
  ): Promise<AigenProviderImageResult>;
}

export type AigenRemoteModelListRequest = {
  kind?: AigenMediaKind;
};

export type AigenRemoteModel = {
  providerLocalModel: string;
  displayName?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  pricing?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type AigenRemoteModelListResult = {
  models: AigenRemoteModel[];
  metadata?: Record<string, unknown>;
};

export interface AigenRemoteModelListProvider {
  listRemoteModels(
    request: AigenRemoteModelListRequest,
    context: AigenProviderContext,
  ): Promise<AigenRemoteModelListResult>;
}

export const isRemoteModelListProvider = (
  provider: AigenImageProvider,
): provider is AigenImageProvider & AigenRemoteModelListProvider =>
  "listRemoteModels" in provider && typeof provider.listRemoteModels === "function";
