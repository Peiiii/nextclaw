import { MainRunnerService } from "./main-runner.service.js";
import type { MainRunRequest, MainRunResult } from "./main-runner.types.js";
import { WasmSidecarClientService } from "../sidecar/wasm-sidecar-client.service.js";

export class WasmMainRunnerService extends MainRunnerService {
  constructor(
    private readonly sidecarClient: WasmSidecarClientService = new WasmSidecarClientService(),
  ) {
    super();
  }

  runDocumentSummary = async (request: MainRunRequest): Promise<MainRunResult> => {
    if (request.bundle.manifest.main.kind !== "wasm") {
      throw new Error("runDocumentSummary 只支持 main.kind=wasm。");
    }
    const output = await this.sidecarClient.runExport({
      wasmPath: request.bundle.mainEntryPath,
      exportName: request.bundle.manifest.main.export,
      args: [request.input.documentCount, request.input.textBytes],
    });
    return {
      exportName: request.bundle.manifest.main.export,
      output,
    };
  };
}
