import type { RuntimeControlActionResult, RuntimeControlView } from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class RuntimeControlService {
  constructor(private readonly requestService: RequestService) {}

  readonly fetch = async (): Promise<RuntimeControlView> => {
    return await this.requestService.get<RuntimeControlView>("/api/runtime/control");
  };

  readonly startService = async (): Promise<RuntimeControlActionResult> => {
    return await this.requestService.post<RuntimeControlActionResult>("/api/runtime/control/start-service", {});
  };

  readonly restartService = async (): Promise<RuntimeControlActionResult> => {
    return await this.requestService.post<RuntimeControlActionResult>("/api/runtime/control/restart-service", {});
  };

  readonly stopService = async (): Promise<RuntimeControlActionResult> => {
    return await this.requestService.post<RuntimeControlActionResult>("/api/runtime/control/stop-service", {});
  };
}
