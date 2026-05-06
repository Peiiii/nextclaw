import type {
  ChatSessionTypesView,
  ConfigActionExecuteRequest,
  ConfigActionExecuteResult,
  ConfigMetaView,
  ConfigSchemaResponse,
  ConfigView,
  CronActionResult,
  CronEnableRequest,
  CronListView,
  CronRunRequest,
  ProviderAuthImportResult,
  ProviderAuthPollRequest,
  ProviderAuthPollResult,
  ProviderAuthStartRequest,
  ProviderAuthStartResult,
  ProviderConfigView,
  ProviderConfigUpdate,
  ProviderConnectionTestRequest,
  ProviderConnectionTestResult,
  ProviderCreateRequest,
  ProviderCreateResult,
  ProviderDeleteResult,
  RuntimeConfigUpdate,
  SearchConfigUpdate,
  SearchConfigView,
  SecretsConfigUpdate,
  SecretsView
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class ConfigService {
  constructor(private readonly requestService: RequestService) {}

  readonly fetch = async (): Promise<ConfigView> => {
    return await this.requestService.get<ConfigView>("/api/config");
  };

  readonly fetchMeta = async (): Promise<ConfigMetaView> => {
    return await this.requestService.get<ConfigMetaView>("/api/config/meta");
  };

  readonly fetchSchema = async (): Promise<ConfigSchemaResponse> => {
    return await this.requestService.get<ConfigSchemaResponse>("/api/config/schema");
  };

  readonly updateModel = async (data: { model: string; workspace?: string }): Promise<{ model: string; workspace?: string }> => {
    return await this.requestService.put<{ model: string; workspace?: string }>("/api/config/model", data);
  };

  readonly updateSearch = async (data: SearchConfigUpdate): Promise<SearchConfigView> => {
    return await this.requestService.put<SearchConfigView>("/api/config/search", data);
  };

  readonly updateProvider = async (provider: string, data: ProviderConfigUpdate): Promise<ProviderConfigView> => {
    return await this.requestService.put<ProviderConfigView>(`/api/config/providers/${provider}`, data);
  };

  readonly createProvider = async (data: ProviderCreateRequest = {}): Promise<ProviderCreateResult> => {
    return await this.requestService.post<ProviderCreateResult>("/api/config/providers", data);
  };

  readonly deleteProvider = async (provider: string): Promise<ProviderDeleteResult> => {
    return await this.requestService.delete<ProviderDeleteResult>(`/api/config/providers/${provider}`);
  };

  readonly testProviderConnection = async (
    provider: string,
    data: ProviderConnectionTestRequest
  ): Promise<ProviderConnectionTestResult> => {
    return await this.requestService.post<ProviderConnectionTestResult>(
      `/api/config/providers/${provider}/test`,
      data
    );
  };

  readonly startProviderAuth = async (
    provider: string,
    data: ProviderAuthStartRequest = {}
  ): Promise<ProviderAuthStartResult> => {
    return await this.requestService.post<ProviderAuthStartResult>(
      `/api/config/providers/${provider}/auth/start`,
      data
    );
  };

  readonly pollProviderAuth = async (
    provider: string,
    data: ProviderAuthPollRequest
  ): Promise<ProviderAuthPollResult> => {
    return await this.requestService.post<ProviderAuthPollResult>(
      `/api/config/providers/${provider}/auth/poll`,
      data
    );
  };

  readonly importProviderAuthFromCli = async (provider: string): Promise<ProviderAuthImportResult> => {
    return await this.requestService.post<ProviderAuthImportResult>(
      `/api/config/providers/${provider}/auth/import-cli`,
      {}
    );
  };

  readonly updateChannel = async (
    channel: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> => {
    return await this.requestService.put<Record<string, unknown>>(
      `/api/config/channels/${encodeURIComponent(channel)}`,
      data
    );
  };

  readonly updateRuntime = async (
    data: RuntimeConfigUpdate
  ): Promise<Pick<ConfigView, "companion" | "agents" | "bindings" | "session">> => {
    return await this.requestService.put<Pick<ConfigView, "companion" | "agents" | "bindings" | "session">>(
      "/api/config/runtime",
      data
    );
  };

  readonly updateSecrets = async (data: SecretsConfigUpdate): Promise<SecretsView> => {
    return await this.requestService.put<SecretsView>("/api/config/secrets", data);
  };

  readonly executeAction = async (
    actionId: string,
    data: ConfigActionExecuteRequest = {}
  ): Promise<ConfigActionExecuteResult> => {
    return await this.requestService.post<ConfigActionExecuteResult>(
      `/api/config/actions/${encodeURIComponent(actionId)}/execute`,
      data
    );
  };

  readonly fetchChatSessionTypes = async (): Promise<ChatSessionTypesView> => {
    return await this.requestService.get<ChatSessionTypesView>("/api/ncp/session-types");
  };

  readonly fetchCronJobs = async (params: { all?: boolean } = {}): Promise<CronListView> => {
    return await this.requestService.get<CronListView>("/api/cron", {
      query: params.all ? { all: "1" } : undefined
    });
  };

  readonly deleteCronJob = async (jobId: string): Promise<{ deleted: boolean }> => {
    return await this.requestService.delete<{ deleted: boolean }>(
      `/api/cron/${encodeURIComponent(jobId)}`
    );
  };

  readonly setCronJobEnabled = async (jobId: string, data: CronEnableRequest): Promise<CronActionResult> => {
    return await this.requestService.put<CronActionResult>(
      `/api/cron/${encodeURIComponent(jobId)}/enable`,
      data
    );
  };

  readonly runCronJob = async (jobId: string, data: CronRunRequest = {}): Promise<CronActionResult> => {
    return await this.requestService.post<CronActionResult>(
      `/api/cron/${encodeURIComponent(jobId)}/run`,
      data
    );
  };
}
