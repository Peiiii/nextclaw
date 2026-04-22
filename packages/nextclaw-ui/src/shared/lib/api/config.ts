import { api } from './client';
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
} from './types';

// GET /api/auth/status
export async function fetchAuthStatus(options: { timeoutMs?: number } = {}): Promise<AuthStatusView> {
  const response = await api.get<AuthStatusView>('/api/auth/status', { timeoutMs: options.timeoutMs ?? 5_000 });
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/auth/setup
export async function setupAuth(data: AuthSetupRequest): Promise<AuthStatusView> {
  const response = await api.post<AuthStatusView>('/api/auth/setup', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/auth/login
export async function loginAuth(data: AuthLoginRequest): Promise<AuthStatusView> {
  const response = await api.post<AuthStatusView>('/api/auth/login', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/auth/logout
export async function logoutAuth(): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>('/api/auth/logout', {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/auth/password
export async function updateAuthPassword(data: AuthPasswordUpdateRequest): Promise<AuthStatusView> {
  const response = await api.put<AuthStatusView>('/api/auth/password', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/auth/enabled
export async function updateAuthEnabled(data: AuthEnabledUpdateRequest): Promise<AuthStatusView> {
  const response = await api.put<AuthStatusView>('/api/auth/enabled', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/app/meta
export async function fetchAppMeta(): Promise<AppMetaView> {
  const response = await api.get<AppMetaView>('/api/app/meta');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/runtime/bootstrap-status
export async function fetchBootstrapStatus(): Promise<BootstrapStatusView> {
  const response = await api.get<BootstrapStatusView>('/api/runtime/bootstrap-status');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/config
export async function fetchConfig(): Promise<ConfigView> {
  const response = await api.get<ConfigView>('/api/config');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/config/meta
export async function fetchConfigMeta(): Promise<ConfigMetaView> {
  const response = await api.get<ConfigMetaView>('/api/config/meta');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/config/schema
export async function fetchConfigSchema(): Promise<ConfigSchemaResponse> {
  const response = await api.get<ConfigSchemaResponse>('/api/config/schema');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/config/model
export async function updateModel(data: { model: string; workspace?: string }): Promise<{ model: string; workspace?: string }> {
  const response = await api.put<{ model: string; workspace?: string }>('/api/config/model', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/config/search
export async function updateSearch(
  data: SearchConfigUpdate
): Promise<SearchConfigView> {
  const response = await api.put<SearchConfigView>('/api/config/search', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/config/providers/:provider
export async function updateProvider(
  provider: string,
  data: ProviderConfigUpdate
): Promise<ProviderConfigView> {
  const response = await api.put<ProviderConfigView>(
    `/api/config/providers/${provider}`,
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/config/providers
export async function createProvider(
  data: ProviderCreateRequest = {}
): Promise<ProviderCreateResult> {
  const response = await api.post<ProviderCreateResult>(
    '/api/config/providers',
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// DELETE /api/config/providers/:provider
export async function deleteProvider(provider: string): Promise<ProviderDeleteResult> {
  const response = await api.delete<ProviderDeleteResult>(
    `/api/config/providers/${provider}`
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/config/providers/:provider/test
export async function testProviderConnection(
  provider: string,
  data: ProviderConnectionTestRequest
): Promise<ProviderConnectionTestResult> {
  const response = await api.post<ProviderConnectionTestResult>(
    `/api/config/providers/${provider}/test`,
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/config/providers/:provider/auth/start
export async function startProviderAuth(
  provider: string,
  data: ProviderAuthStartRequest = {}
): Promise<ProviderAuthStartResult> {
  const response = await api.post<ProviderAuthStartResult>(
    `/api/config/providers/${provider}/auth/start`,
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/config/providers/:provider/auth/poll
export async function pollProviderAuth(
  provider: string,
  data: ProviderAuthPollRequest
): Promise<ProviderAuthPollResult> {
  const response = await api.post<ProviderAuthPollResult>(
    `/api/config/providers/${provider}/auth/poll`,
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/config/providers/:provider/auth/import-cli
export async function importProviderAuthFromCli(provider: string): Promise<ProviderAuthImportResult> {
  const response = await api.post<ProviderAuthImportResult>(
    `/api/config/providers/${provider}/auth/import-cli`,
    {}
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/config/channels/:channel
export async function updateChannel(
  channel: string,
  data: ChannelConfigUpdate
): Promise<Record<string, unknown>> {
  const response = await api.put<Record<string, unknown>>(
    `/api/config/channels/${channel}`,
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/config/runtime
export async function updateRuntime(
  data: RuntimeConfigUpdate
): Promise<Pick<ConfigView, 'agents' | 'bindings' | 'session'>> {
  const response = await api.put<Pick<ConfigView, 'agents' | 'bindings' | 'session'>>(
    '/api/config/runtime',
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/config/secrets
export async function updateSecrets(
  data: SecretsConfigUpdate
): Promise<SecretsView> {
  const response = await api.put<SecretsView>(
    '/api/config/secrets',
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/config/actions/:id/execute
export async function executeConfigAction(
  actionId: string,
  data: ConfigActionExecuteRequest
): Promise<ConfigActionExecuteResult> {
  const response = await api.post<ConfigActionExecuteResult>(
    `/api/config/actions/${actionId}/execute`,
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/ncp/session-types
export async function fetchNcpChatSessionTypes(): Promise<ChatSessionTypesView> {
  const response = await api.get<ChatSessionTypesView>('/api/ncp/session-types');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/cron
export async function fetchCronJobs(params?: { all?: boolean }): Promise<CronListView> {
  const query = new URLSearchParams();
  if (params?.all) {
    query.set('all', '1');
  }
  const suffix = query.toString();
  const response = await api.get<CronListView>(suffix ? '/api/cron?' + suffix : '/api/cron');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// DELETE /api/cron/:id
export async function deleteCronJob(id: string): Promise<{ deleted: boolean }> {
  const response = await api.delete<{ deleted: boolean }>(`/api/cron/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/cron/:id/enable
export async function setCronJobEnabled(id: string, data: CronEnableRequest): Promise<CronActionResult> {
  const response = await api.put<CronActionResult>(`/api/cron/${encodeURIComponent(id)}/enable`, data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/cron/:id/run
export async function runCronJob(id: string, data: CronRunRequest): Promise<CronActionResult> {
  const response = await api.post<CronActionResult>(`/api/cron/${encodeURIComponent(id)}/run`, data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
