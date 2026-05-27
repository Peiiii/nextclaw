import type {
  ServiceActionGrantView,
  ServiceActionGrantListView,
  ServiceActionInvokeResultView,
  ServiceActionListView,
  ServiceAppListView,
  ServiceAppRecordView,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

const PANEL_BRIDGE_SESSION_HEADER = "x-nextclaw-panel-bridge-session";

type BridgeRequestOptions = {
  bridgeSessionToken?: string;
};

type ListServiceActionsOptions = BridgeRequestOptions & {
  appId?: string;
};

function bridgeHeaders(token?: string): Record<string, string> | undefined {
  return token ? { [PANEL_BRIDGE_SESSION_HEADER]: token } : undefined;
}

export class ServiceAppsClientService {
  constructor(private readonly requestService: RequestService) {}

  readonly listServiceApps = async (): Promise<ServiceAppListView> => {
    return await this.requestService.get<ServiceAppListView>("/api/service-apps");
  };

  readonly getServiceApp = async (appId: string): Promise<ServiceAppRecordView> => {
    return await this.requestService.get<ServiceAppRecordView>(
      `/api/service-apps/${encodeURIComponent(appId)}`,
    );
  };

  readonly restartServiceApp = async (appId: string): Promise<ServiceAppRecordView> => {
    return await this.requestService.post<ServiceAppRecordView>(
      `/api/service-apps/${encodeURIComponent(appId)}/restart`,
    );
  };

  readonly listServiceActions = async (
    options: ListServiceActionsOptions = {},
  ): Promise<ServiceActionListView> => {
    const search = options.appId
      ? `?${new URLSearchParams({ appId: options.appId }).toString()}`
      : "";
    return await this.requestService.get<ServiceActionListView>(
      `/api/service-actions${search}`,
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly discoverServiceAppActions = async (
    appId: string,
  ): Promise<ServiceActionListView> => {
    return await this.requestService.post<ServiceActionListView>(
      `/api/service-apps/${encodeURIComponent(appId)}/actions/discover`,
      {},
    );
  };

  readonly invokeServiceAction = async (
    actionId: string,
    input?: Record<string, unknown>,
    options: BridgeRequestOptions = {},
  ): Promise<ServiceActionInvokeResultView> => {
    return await this.requestService.post<ServiceActionInvokeResultView>(
      `/api/service-actions/${encodeURIComponent(actionId)}/invoke`,
      { input: input ?? {} },
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly grantServiceAction = async (
    actionId: string,
    options: BridgeRequestOptions = {},
  ): Promise<ServiceActionGrantView> => {
    return await this.requestService.post<ServiceActionGrantView>(
      `/api/service-actions/${encodeURIComponent(actionId)}/grant`,
      {},
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly listServiceActionGrants = async (): Promise<ServiceActionGrantListView> => {
    return await this.requestService.get<ServiceActionGrantListView>(
      "/api/service-action-grants",
    );
  };

  readonly revokeServiceAction = async (
    actionId: string,
    options: BridgeRequestOptions = {},
  ): Promise<{ revoked: boolean }> => {
    return await this.requestService.delete<{ revoked: boolean }>(
      `/api/service-actions/${encodeURIComponent(actionId)}/grant`,
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly revokeServiceActionGrant = async (params: {
    actionId: string;
    caller: { surface: "panel-app"; appId: string };
  }): Promise<{ revoked: boolean }> => {
    const search = new URLSearchParams({
      surface: params.caller.surface,
      appId: params.caller.appId,
    });
    return await this.requestService.delete<{ revoked: boolean }>(
      `/api/service-action-grants/${encodeURIComponent(params.actionId)}?${search.toString()}`,
    );
  };
}
