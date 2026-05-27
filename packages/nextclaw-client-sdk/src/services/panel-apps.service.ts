import type {
  PanelAppBridgeSessionCreateRequest,
  PanelAppBridgeSessionView,
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

  readonly createBridgeSession = async (
    request: PanelAppBridgeSessionCreateRequest,
  ): Promise<PanelAppBridgeSessionView> => {
    return await this.requestService.post<PanelAppBridgeSessionView>(
      "/api/panel-app-bridge-sessions",
      request,
    );
  };

  readonly deleteBridgeSession = async (token: string): Promise<{ deleted: boolean }> => {
    return await this.requestService.delete<{ deleted: boolean }>(
      `/api/panel-app-bridge-sessions/${encodeURIComponent(token)}`,
    );
  };
}
