import type {
  ProviderAuthImportResult,
  ProviderAuthPollRequest,
  ProviderAuthPollResult,
  ProviderAuthStartRequest,
  ProviderAuthStartResult,
  ProviderConfigUpdate,
  ProviderConnectionTestRequest,
  ProviderConnectionTestResult,
  ProviderCreateRequest,
  ProviderCreateResult,
  ProviderDeleteResult,
  ProvidersView,
  ProviderTemplatesView,
  ProviderInstanceView,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class ProviderService {
  constructor(private readonly requestService: RequestService) {}

  readonly list = async (): Promise<ProvidersView> => {
    return await this.requestService.get<ProvidersView>("/api/providers");
  };

  readonly listTemplates = async (): Promise<ProviderTemplatesView> => {
    return await this.requestService.get<ProviderTemplatesView>("/api/provider-templates");
  };

  readonly update = async (providerId: string, data: ProviderConfigUpdate): Promise<ProviderInstanceView> => {
    return await this.requestService.put<ProviderInstanceView>(
      `/api/providers/${encodeURIComponent(providerId)}`,
      data
    );
  };

  readonly create = async (data: ProviderCreateRequest = {}): Promise<ProviderCreateResult> => {
    return await this.requestService.post<ProviderCreateResult>("/api/providers", data);
  };

  readonly delete = async (providerId: string): Promise<ProviderDeleteResult> => {
    return await this.requestService.delete<ProviderDeleteResult>(
      `/api/providers/${encodeURIComponent(providerId)}`
    );
  };

  readonly testConnection = async (
    providerId: string,
    data: ProviderConnectionTestRequest
  ): Promise<ProviderConnectionTestResult> => {
    return await this.requestService.post<ProviderConnectionTestResult>(
      `/api/providers/${encodeURIComponent(providerId)}/test`,
      data
    );
  };

  readonly startAuth = async (
    providerId: string,
    data: ProviderAuthStartRequest = {}
  ): Promise<ProviderAuthStartResult> => {
    return await this.requestService.post<ProviderAuthStartResult>(
      `/api/providers/${encodeURIComponent(providerId)}/auth/start`,
      data
    );
  };

  readonly pollAuth = async (
    providerId: string,
    data: ProviderAuthPollRequest
  ): Promise<ProviderAuthPollResult> => {
    return await this.requestService.post<ProviderAuthPollResult>(
      `/api/providers/${encodeURIComponent(providerId)}/auth/poll`,
      data
    );
  };

  readonly importAuthFromCli = async (providerId: string): Promise<ProviderAuthImportResult> => {
    return await this.requestService.post<ProviderAuthImportResult>(
      `/api/providers/${encodeURIComponent(providerId)}/auth/import-cli`,
      {}
    );
  };
}
