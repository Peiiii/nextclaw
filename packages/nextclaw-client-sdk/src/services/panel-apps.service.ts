import type {
  PanelAppAgentCapabilityView,
  PanelAppAgentGenerateObjectRequestView,
  PanelAppAgentGenerateObjectResultView,
  PanelAppAgentSendRequestView,
  PanelAppAgentSendResultView,
  PanelAppBridgeSessionCreateRequest,
  PanelAppBridgeSessionView,
  PanelAppCapabilityGrantView,
  PanelAppDeleteResultView,
  PanelAppEntryView,
  PanelAppListView,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

const PANEL_BRIDGE_SESSION_HEADER = "x-nextclaw-panel-bridge-session";

type PanelAppPreferencesUpdateView = {
  favorite?: boolean;
};

type BridgeRequestOptions = {
  bridgeSessionToken?: string;
};

function bridgeHeaders(token?: string): Record<string, string> | undefined {
  return token ? { [PANEL_BRIDGE_SESSION_HEADER]: token } : undefined;
}

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

  readonly deletePanelApp = async (id: string): Promise<PanelAppDeleteResultView> => {
    return await this.requestService.delete<PanelAppDeleteResultView>(
      `/api/panel-apps/${encodeURIComponent(id)}`,
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

  readonly sendAgentMessage = async (
    request: PanelAppAgentSendRequestView,
    options: BridgeRequestOptions = {},
  ): Promise<PanelAppAgentSendResultView> => {
    return await this.requestService.post<PanelAppAgentSendResultView>(
      "/api/panel-app-agent/send",
      request,
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly generateAgentObject = async (
    request: PanelAppAgentGenerateObjectRequestView,
    options: BridgeRequestOptions = {},
  ): Promise<PanelAppAgentGenerateObjectResultView> => {
    return await this.requestService.post<PanelAppAgentGenerateObjectResultView>(
      "/api/panel-app-agent/generate-object",
      request,
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly grantAgentCapability = async (
    capability: PanelAppAgentCapabilityView,
    options: BridgeRequestOptions = {},
  ): Promise<PanelAppCapabilityGrantView> => {
    return await this.requestService.post<PanelAppCapabilityGrantView>(
      `/api/panel-app-agent-capabilities/${encodeURIComponent(capability)}/grant`,
      {},
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };
}
