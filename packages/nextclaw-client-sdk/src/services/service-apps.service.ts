import type {
  ServiceActionGrantView,
  ServiceActionGrantListView,
  ServiceActionInvokeResultView,
  ServiceActionListView,
  ServiceAppDeleteResultView,
  ServiceAppListView,
  ServiceAppRecordView,
  PortableRuntimeAcceptanceContractApiView,
  PortableRuntimeAcceptanceExportApiView,
  PortableRuntimeAcceptanceStatusApiView,
  RuntimeVerificationRecordListView,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

const PANEL_BRIDGE_SESSION_HEADER = "x-nextclaw-panel-bridge-session";

type BridgeRequestOptions = {
  bridgeSessionToken?: string;
};

type ListServiceActionsOptions = BridgeRequestOptions & {
  appId?: string;
};

type PortableRuntimeAcceptanceOptions = BridgeRequestOptions & {
  appId?: string;
  locale?: string;
};

type ListVerificationRecordsOptions = BridgeRequestOptions & {
  acceptanceId?: string;
  appId?: string;
  limit?: number;
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

  readonly deleteServiceApp = async (
    appId: string,
    purgeData = false,
  ): Promise<ServiceAppDeleteResultView> => {
    return await this.requestService.request<ServiceAppDeleteResultView>(
      `/api/service-apps/${encodeURIComponent(appId)}`,
      { method: "DELETE", body: { purgeData } },
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

  readonly listVerificationRecords = async (
    options: ListVerificationRecordsOptions = {},
  ): Promise<RuntimeVerificationRecordListView> => {
    const search = new URLSearchParams();
    if (options.acceptanceId) search.set("acceptanceId", options.acceptanceId);
    if (options.appId) search.set("appId", options.appId);
    if (options.limit !== undefined) search.set("limit", String(options.limit));
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return await this.requestService.get<RuntimeVerificationRecordListView>(
      `/api/runtime-verification-records${suffix}`,
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly getPortableRuntimeAcceptanceContract = async (
    options: Pick<PortableRuntimeAcceptanceOptions, "bridgeSessionToken" | "locale"> = {},
  ): Promise<PortableRuntimeAcceptanceContractApiView> => {
    const search = options.locale ? `?${new URLSearchParams({ locale: options.locale })}` : "";
    return await this.requestService.get<PortableRuntimeAcceptanceContractApiView>(
      `/api/portable-runtime/acceptance/contract${search}`,
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly getPortableRuntimeAcceptanceStatus = async (
    options: PortableRuntimeAcceptanceOptions = {},
  ): Promise<PortableRuntimeAcceptanceStatusApiView> => {
    const search = new URLSearchParams();
    if (options.appId) search.set("appId", options.appId);
    if (options.locale) search.set("locale", options.locale);
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return await this.requestService.get<PortableRuntimeAcceptanceStatusApiView>(
      `/api/portable-runtime/acceptance/status${suffix}`,
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly exportPortableRuntimeAcceptance = async (
    options: PortableRuntimeAcceptanceOptions = {},
  ): Promise<PortableRuntimeAcceptanceExportApiView> => {
    const search = new URLSearchParams();
    if (options.appId) search.set("appId", options.appId);
    if (options.locale) search.set("locale", options.locale);
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return await this.requestService.get<PortableRuntimeAcceptanceExportApiView>(
      `/api/portable-runtime/acceptance/export${suffix}`,
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

  readonly grantServiceActions = async (
    actionIds: string[],
    options: BridgeRequestOptions = {},
  ): Promise<ServiceActionGrantListView> => {
    return await this.requestService.post<ServiceActionGrantListView>(
      "/api/service-action-grants",
      { actionIds },
      { headers: bridgeHeaders(options.bridgeSessionToken) },
    );
  };

  readonly grantAgentServiceActions = async (
    agentId: string,
    actionIds: string[],
  ): Promise<ServiceActionGrantListView> => {
    return await this.requestService.post<ServiceActionGrantListView>(
      `/api/agents/${encodeURIComponent(agentId)}/service-action-grants`,
      { actionIds },
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
    caller:
      | { surface: "panel-app"; appId: string }
      | { surface: "agent"; agentId: string };
  }): Promise<{ revoked: boolean }> => {
    const { actionId, caller } = params;
    const search = new URLSearchParams({
      surface: caller.surface,
      callerId: caller.surface === "panel-app"
        ? caller.appId
        : caller.agentId,
    });
    return await this.requestService.delete<{ revoked: boolean }>(
      `/api/service-action-grants/${encodeURIComponent(actionId)}?${search.toString()}`,
    );
  };
}
