export type AigenImageInput = {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
  quality?: string;
  background?: string;
  outputFormat?: string;
  outputCompression?: number;
  moderation?: string;
  outputDir: string;
  outputName: string;
};

export type AigenImageAsset = {
  path: string;
  filename: string;
  mimeType: string;
  format?: string;
  width?: number;
  height?: number;
  sizeBytes: number;
};

export type AigenImageSuccessOutput = {
  ok: true;
  kind: "image";
  provider: string;
  apiFormat: string;
  model: string;
  providerLocalModel: string;
  assets: AigenImageAsset[];
  usage?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type AigenImageOutput = AigenImageSuccessOutput;
