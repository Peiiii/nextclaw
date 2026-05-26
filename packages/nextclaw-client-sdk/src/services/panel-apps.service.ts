import type {
  PanelAppEntryView,
  PanelAppListView,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

type PanelAppPreferencesUpdateView = {
  favorite?: boolean;
};

export class PanelAppsClientService {
  constructor(private readonly requestService: RequestService) {}

  readonly listPanelApps = async (): Promise<PanelAppListView> => {
    return await this.requestService.get<PanelAppListView>("/api/panel-apps");
  };

  readonly updatePanelAppPreferences = async (
    id: string,
    preferences: PanelAppPreferencesUpdateView,
  ): Promise<PanelAppEntryView> => {
    return await this.requestService.request<PanelAppEntryView>(
      `/api/panel-apps/${encodeURIComponent(id)}/preferences`,
      {
        method: "PATCH",
        body: preferences,
      },
    );
  };

  readonly recordPanelAppOpened = async (id: string): Promise<PanelAppEntryView> => {
    return await this.requestService.post<PanelAppEntryView>(
      `/api/panel-apps/${encodeURIComponent(id)}/open`,
    );
  };
}
