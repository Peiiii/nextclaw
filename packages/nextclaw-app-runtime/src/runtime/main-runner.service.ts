import type { MainRunRequest, MainRunResult } from "./main-runner.types.js";

export abstract class MainRunnerService {
  abstract runDocumentSummary(request: MainRunRequest): Promise<MainRunResult>;
}
