import { describe, expect, it } from "vitest";
import path from "node:path";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import { WasmMainRunnerService } from "./wasm-main-runner.service.js";

describe("WasmMainRunnerService", () => {
  it("runs the example wasm export", async () => {
    const manifestService = new AppManifestService();
    const bundle = await manifestService.load(
      path.resolve(process.cwd(), "../../apps/examples/hello-notes"),
    );
    const service = new WasmMainRunnerService();

    const result = await service.runDocumentSummary({
      bundle,
      input: {
        documentCount: 2,
        textBytes: 14,
      },
    });

    expect(result.output).toBe(214);
  });
});
