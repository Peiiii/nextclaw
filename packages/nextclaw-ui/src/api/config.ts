import { api } from './client';
import type {
  ConfigView,
  ConfigMetaView,
  ConfigSchemaResponse,
  ProviderConfigView,
  ChannelConfigUpdate,
  ProviderConfigUpdate,
  RuntimeConfigUpdate,
  ConfigActionExecuteRequest,
  ConfigActionExecuteResult,
  SessionsListView,
  SessionHistoryView,
  SessionPatchUpdate
} from './types';

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
  maxTokens?: number;
}): Promise<{ model: string; maxTokens?: number }> {
  const response = await api.put<{ model: string; maxTokens?: number }>('/api/config/model', data);
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
