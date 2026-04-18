import type { AppManifestBundle } from "../manifest/app-manifest.types.js";

export type WasmDocumentSummaryInput = {
  documentCount: number;
  textBytes: number;
};

export type MainRunRequest = {
  bundle: AppManifestBundle;
  input: WasmDocumentSummaryInput;
};

export type MainRunResult = {
  exportName: string;
  output: number;
};
