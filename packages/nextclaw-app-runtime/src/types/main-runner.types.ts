import type { AppStandaloneManifestBundle } from "#app-runtime/types/app-manifest.types.js";

export type WasmDocumentSummaryInput = {
  documentCount: number;
  textBytes: number;
};

export type MainRunRequest = {
  bundle: AppStandaloneManifestBundle;
  input: WasmDocumentSummaryInput;
};

export type MainRunResult = {
  exportName: string;
  output: number;
};
