import { api } from './client';
import { appClient } from '@/transport';
import type {
  AuthEnabledUpdateRequest,
  AuthLoginRequest,
  AuthPasswordUpdateRequest,
  AuthSetupRequest,
  AuthStatusView,
  AppMetaView,
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
  SessionsListView,
  SessionHistoryView,
  SessionPatchUpdate,
  ChatTurnRequest,
  ChatTurnView,
  ChatTurnStreamDeltaEvent,
  ChatTurnStreamErrorEvent,
  ChatTurnStreamReadyEvent,
  ChatTurnStreamSessionEvent,
  ChatCapabilitiesView,
  ChatSessionTypesView,
  ChatTurnStopRequest,
  ChatTurnStopResult,
  ChatRunListView,
  ChatRunState,
  ChatRunView,
  CronListView,
  CronEnableRequest,
  CronRunRequest,
  CronActionResult
} from './types';

// GET /api/auth/status
export async function fetchAuthStatus(): Promise<AuthStatusView> {
  const response = await api.get<AuthStatusView>('/api/auth/status');
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
export async function updateModel(data: {
  model: string;
}): Promise<{ model: string }> {
  const response = await api.put<{ model: string }>('/api/config/model', data);
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


// GET /api/sessions
export async function fetchSessions(params?: { q?: string; limit?: number; activeMinutes?: number }): Promise<SessionsListView> {
  const query = new URLSearchParams();
  if (params?.q?.trim()) {
    query.set('q', params.q.trim());
  }
  if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(Math.max(0, Math.trunc(params.limit))));
  }
  if (typeof params?.activeMinutes === 'number' && Number.isFinite(params.activeMinutes)) {
    query.set('activeMinutes', String(Math.max(0, Math.trunc(params.activeMinutes))));
  }
  const suffix = query.toString();
  const response = await api.get<SessionsListView>(suffix ? '/api/sessions?' + suffix : '/api/sessions');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/sessions/:key/history
export async function fetchSessionHistory(key: string, limit = 200): Promise<SessionHistoryView> {
  const response = await api.get<SessionHistoryView>(`/api/sessions/${encodeURIComponent(key)}/history?limit=${Math.max(1, Math.trunc(limit))}`);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/sessions/:key
export async function updateSession(
  key: string,
  data: SessionPatchUpdate
): Promise<SessionHistoryView> {
  const response = await api.put<SessionHistoryView>(`/api/sessions/${encodeURIComponent(key)}`, data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// DELETE /api/sessions/:key
export async function deleteSession(key: string): Promise<{ deleted: boolean }> {
  const response = await api.delete<{ deleted: boolean }>(`/api/sessions/${encodeURIComponent(key)}`);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/chat/turn
export async function sendChatTurn(data: ChatTurnRequest): Promise<ChatTurnView> {
  const response = await api.post<ChatTurnView>('/api/chat/turn', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

async function readSseStream(params: {
  path: string;
  method: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  onReady: (event: ChatTurnStreamReadyEvent) => void;
  onDelta: (event: ChatTurnStreamDeltaEvent) => void;
  onSessionEvent: (event: ChatTurnStreamSessionEvent) => void;
}): Promise<{ sessionKey: string; reply: string }> {
  let finalResult: { sessionKey: string; reply: string } | null = null;
  let readySessionKey = '';

  const session = appClient.openStream<ChatTurnView>({
    method: params.method,
    path: params.path,
    ...(params.body !== undefined ? { body: params.body } : {}),
    signal: params.signal,
    onEvent: (event) => {
      if (event.name === 'ready') {
        const ready = (event.payload ?? {}) as ChatTurnStreamReadyEvent;
        if (typeof ready.sessionKey === 'string' && ready.sessionKey.trim()) {
          readySessionKey = ready.sessionKey;
        }
        params.onReady(ready);
        return;
      }

      if (event.name === 'delta') {
        params.onDelta((event.payload ?? { delta: '' }) as ChatTurnStreamDeltaEvent);
        return;
      }

      if (event.name === 'session_event') {
        params.onSessionEvent({ data: event.payload as ChatTurnStreamSessionEvent['data'] });
        return;
      }

      if (event.name === 'final') {
        const result = event.payload as ChatTurnView;
        finalResult = {
          sessionKey: typeof result?.sessionKey === 'string' && result.sessionKey.trim()
            ? result.sessionKey
            : readySessionKey,
          reply: typeof result?.reply === 'string' ? result.reply : ''
        };
        return;
      }

      if (event.name === 'error') {
        const errorPayload = (event.payload ?? {}) as ChatTurnStreamErrorEvent;
        throw new Error((errorPayload.message ?? '').trim() || 'chat stream failed');
      }
    }
  });

  const result = await session.finished;
  if (finalResult) {
    return finalResult;
  }
  if (readySessionKey) {
    return {
      sessionKey: readySessionKey,
      reply: typeof result?.reply === 'string' ? result.reply : ''
    };
  }
  if (typeof result?.sessionKey === 'string' && result.sessionKey.trim()) {
    return {
      sessionKey: result.sessionKey,
      reply: typeof result?.reply === 'string' ? result.reply : ''
    };
  }
  throw new Error('chat stream ended without final event');
}

// POST /api/chat/turn/stream
export async function sendChatTurnStream(
  data: ChatTurnRequest,
  params: {
    signal?: AbortSignal;
    onReady: (event: ChatTurnStreamReadyEvent) => void;
    onDelta: (event: ChatTurnStreamDeltaEvent) => void;
    onSessionEvent: (event: ChatTurnStreamSessionEvent) => void;
  }
): Promise<{ sessionKey: string; reply: string }> {
  return readSseStream({
    path: '/api/chat/turn/stream',
    method: 'POST',
    body: data,
    signal: params.signal,
    onReady: params.onReady,
    onDelta: params.onDelta,
    onSessionEvent: params.onSessionEvent
  });
}

// GET /api/chat/runs/:runId/stream
export async function streamChatRun(
  data: {
    runId: string;
    fromEventIndex?: number;
  },
  params: {
    signal?: AbortSignal;
    onReady: (event: ChatTurnStreamReadyEvent) => void;
    onDelta: (event: ChatTurnStreamDeltaEvent) => void;
    onSessionEvent: (event: ChatTurnStreamSessionEvent) => void;
  }
): Promise<{ sessionKey: string; reply: string }> {
  const query = new URLSearchParams();
  if (typeof data.fromEventIndex === 'number' && Number.isFinite(data.fromEventIndex)) {
    query.set('fromEventIndex', String(Math.max(0, Math.trunc(data.fromEventIndex))));
  }
  const suffix = query.toString();
  const path = `/api/chat/runs/${encodeURIComponent(data.runId)}/stream${suffix ? `?${suffix}` : ''}`;
  return readSseStream({
    path,
    method: 'GET',
    signal: params.signal,
    onReady: params.onReady,
    onDelta: params.onDelta,
    onSessionEvent: params.onSessionEvent
  });
}

// GET /api/chat/capabilities
export async function fetchChatCapabilities(params?: { sessionKey?: string; agentId?: string }): Promise<ChatCapabilitiesView> {
  const query = new URLSearchParams();
  if (params?.sessionKey?.trim()) {
    query.set('sessionKey', params.sessionKey.trim());
  }
  if (params?.agentId?.trim()) {
    query.set('agentId', params.agentId.trim());
  }
  const suffix = query.toString();
  const response = await api.get<ChatCapabilitiesView>(suffix ? `/api/chat/capabilities?${suffix}` : '/api/chat/capabilities');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/chat/session-types
export async function fetchChatSessionTypes(): Promise<ChatSessionTypesView> {
  const response = await api.get<ChatSessionTypesView>('/api/chat/session-types');
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

// POST /api/chat/turn/stop
export async function stopChatTurn(data: ChatTurnStopRequest): Promise<ChatTurnStopResult> {
  const response = await api.post<ChatTurnStopResult>('/api/chat/turn/stop', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/chat/runs
export async function fetchChatRuns(params?: {
  sessionKey?: string;
  states?: ChatRunState[];
  limit?: number;
}): Promise<ChatRunListView> {
  const query = new URLSearchParams();
  if (params?.sessionKey?.trim()) {
    query.set('sessionKey', params.sessionKey.trim());
  }
  if (Array.isArray(params?.states) && params.states.length > 0) {
    query.set('states', params.states.join(','));
  }
  if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(Math.max(0, Math.trunc(params.limit))));
  }
  const suffix = query.toString();
  const response = await api.get<ChatRunListView>(suffix ? `/api/chat/runs?${suffix}` : '/api/chat/runs');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/chat/runs/:runId
export async function fetchChatRun(runId: string): Promise<ChatRunView> {
  const response = await api.get<ChatRunView>(`/api/chat/runs/${encodeURIComponent(runId)}`);
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
