import type { PanelAppListView } from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class PanelAppsClientService {
  constructor(private readonly requestService: RequestService) {}

  readonly listPanelApps = async (): Promise<PanelAppListView> => {
    return await this.requestService.get<PanelAppListView>("/api/panel-apps");
  };
}
