import { nextclawClient } from '@/shared/lib/api/managers/client.manager';
import type {
  AuthEnabledUpdateRequest,
  AuthLoginRequest,
  AuthPasswordUpdateRequest,
  AuthSetupRequest,
  AuthStatusView,
  AppMetaView,
  BootstrapStatusView,
  ConfigView,
  ConfigMetaView,
  ConfigSchemaResponse,
  ProviderConfigView,
  ChannelConfigUpdate,
  ProviderConfigUpdate,
  ProviderConnectionTestRequest,
  ProviderConnectionTestResult,
  ProviderAuthStartRequest,
  ProviderAuthStartResult,
  ProviderAuthPollRequest,
  ProviderAuthPollResult,
  ProviderAuthImportResult,
  SearchConfigUpdate,
  SearchConfigView,
  ProviderCreateRequest,
  ProviderCreateResult,
  ProviderDeleteResult,
  RuntimeConfigUpdate,
  SecretsConfigUpdate,
  SecretsView,
  ConfigActionExecuteRequest,
  ConfigActionExecuteResult,
  ChatSessionTypesView,
  CronListView,
  CronEnableRequest,
  CronRunRequest,
  CronActionResult
} from '@/shared/lib/api/types';

export async function fetchAuthStatus(options: { timeoutMs?: number } = {}): Promise<AuthStatusView> {
  return await nextclawClient.auth.fetchStatus({
    timeoutMs: options.timeoutMs ?? 5_000,
  });
}

export async function setupAuth(data: AuthSetupRequest): Promise<AuthStatusView> {
  return await nextclawClient.auth.setup(data);
}

export async function loginAuth(data: AuthLoginRequest): Promise<AuthStatusView> {
  return await nextclawClient.auth.login(data);
}

export async function logoutAuth(): Promise<{ success: boolean }> {
  return await nextclawClient.auth.logout();
}

export async function updateAuthPassword(data: AuthPasswordUpdateRequest): Promise<AuthStatusView> {
  return await nextclawClient.auth.updatePassword(data);
}

export async function updateAuthEnabled(data: AuthEnabledUpdateRequest): Promise<AuthStatusView> {
  return await nextclawClient.auth.updateEnabled(data);
}

export async function fetchAppMeta(): Promise<AppMetaView> {
  return await nextclawClient.app.fetchMeta();
}

export async function fetchBootstrapStatus(options: { timeoutMs?: number } = {}): Promise<BootstrapStatusView> {
  return await nextclawClient.app.fetchBootstrapStatus(options);
}

export async function fetchConfig(): Promise<ConfigView> {
  return await nextclawClient.config.fetch();
}

export async function fetchConfigMeta(): Promise<ConfigMetaView> {
  return await nextclawClient.config.fetchMeta();
}

export async function fetchConfigSchema(): Promise<ConfigSchemaResponse> {
  return await nextclawClient.config.fetchSchema();
}

export async function updateModel(data: { model: string; workspace?: string }): Promise<{ model: string; workspace?: string }> {
  return await nextclawClient.config.updateModel(data);
}

export async function updateSearch(data: SearchConfigUpdate): Promise<SearchConfigView> {
  return await nextclawClient.config.updateSearch(data);
}

export async function updateProvider(provider: string, data: ProviderConfigUpdate): Promise<ProviderConfigView> {
  return await nextclawClient.config.updateProvider(provider, data);
}

export async function createProvider(data: ProviderCreateRequest = {}): Promise<ProviderCreateResult> {
  return await nextclawClient.config.createProvider(data);
}

export async function deleteProvider(provider: string): Promise<ProviderDeleteResult> {
  return await nextclawClient.config.deleteProvider(provider);
}

export async function testProviderConnection(
  provider: string,
  data: ProviderConnectionTestRequest
): Promise<ProviderConnectionTestResult> {
  return await nextclawClient.config.testProviderConnection(provider, data);
}

export async function startProviderAuth(
  provider: string,
  data: ProviderAuthStartRequest = {}
): Promise<ProviderAuthStartResult> {
  return await nextclawClient.config.startProviderAuth(provider, data);
}

export async function pollProviderAuth(
  provider: string,
  data: ProviderAuthPollRequest
): Promise<ProviderAuthPollResult> {
  return await nextclawClient.config.pollProviderAuth(provider, data);
}

export async function importProviderAuthFromCli(provider: string): Promise<ProviderAuthImportResult> {
  return await nextclawClient.config.importProviderAuthFromCli(provider);
}

export async function updateChannel(
  channel: string,
  data: ChannelConfigUpdate
): Promise<Record<string, unknown>> {
  return await nextclawClient.config.updateChannel(channel, data);
}

export async function updateRuntime(
  data: RuntimeConfigUpdate
): Promise<Pick<ConfigView, 'agents' | 'bindings' | 'session'>> {
  return await nextclawClient.config.updateRuntime(data) as Pick<ConfigView, 'agents' | 'bindings' | 'session'>;
}

export async function updateSecrets(data: SecretsConfigUpdate): Promise<SecretsView> {
  return await nextclawClient.config.updateSecrets(data);
}

export async function executeConfigAction(
  actionId: string,
  data: ConfigActionExecuteRequest
): Promise<ConfigActionExecuteResult> {
  return await nextclawClient.config.executeAction(actionId, data);
}

export async function fetchNcpChatSessionTypes(): Promise<ChatSessionTypesView> {
  return await nextclawClient.config.fetchChatSessionTypes();
}

export async function fetchCronJobs(params?: { all?: boolean }): Promise<CronListView> {
  return await nextclawClient.config.fetchCronJobs(params);
}

export async function deleteCronJob(id: string): Promise<{ deleted: boolean }> {
  return await nextclawClient.config.deleteCronJob(id);
}

export async function setCronJobEnabled(id: string, data: CronEnableRequest): Promise<CronActionResult> {
  return await nextclawClient.config.setCronJobEnabled(id, data);
}

export async function runCronJob(id: string, data: CronRunRequest): Promise<CronActionResult> {
  return await nextclawClient.config.runCronJob(id, data);
}
