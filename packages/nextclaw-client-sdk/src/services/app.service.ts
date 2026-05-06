import type { AppMetaView, BootstrapStatusView } from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class AppService {
  constructor(private readonly requestService: RequestService) {}

  readonly fetchMeta = async (): Promise<AppMetaView> => {
    return await this.requestService.get<AppMetaView>("/api/app/meta");
  };

  readonly fetchBootstrapStatus = async (): Promise<BootstrapStatusView> => {
    return await this.requestService.get<BootstrapStatusView>("/api/runtime/bootstrap-status");
  };
}
