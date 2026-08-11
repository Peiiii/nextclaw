import type { MainRunRequest, MainRunResult } from "#app-runtime/types/main-runner.types.js";

export abstract class MainRunnerService {
  abstract runDocumentSummary(request: MainRunRequest): Promise<MainRunResult>;
}
