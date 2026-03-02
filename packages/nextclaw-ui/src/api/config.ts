import { api, API_BASE } from './client';
import type {
  ConfigView,
  ConfigMetaView,
  ConfigSchemaResponse,
  ProviderConfigView,
  ChannelConfigUpdate,
  ProviderConfigUpdate,
  ProviderConnectionTestRequest,
  ProviderConnectionTestResult,
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
  CronListView,
  CronEnableRequest,
  CronRunRequest,
  CronActionResult,
  ChatTurnStreamReadyEvent,
  ChatTurnStreamDeltaEvent,
  ChatTurnStreamSessionEvent
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
}): Promise<{ model: string }> {
  const response = await api.put<{ model: string }>('/api/config/model', data);
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

type ChatTurnStreamOptions = {
  signal?: AbortSignal;
  onReady?: (event: ChatTurnStreamReadyEvent) => void;
  onDelta?: (event: ChatTurnStreamDeltaEvent) => void;
  onSessionEvent?: (event: ChatTurnStreamSessionEvent) => void;
};

type SseParsedEvent = {
  event: string;
  data: string;
};

function parseSseFrame(frame: string): SseParsedEvent | null {
  const lines = frame.split(/\r?\n/);
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim() || 'message';
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  return {
    event,
    data: dataLines.join('\n')
  };
}

export async function sendChatTurnStream(
  data: ChatTurnRequest,
  options: ChatTurnStreamOptions = {}
): Promise<ChatTurnView> {
  const response = await fetch(`${API_BASE}/api/chat/turn/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(data),
    signal: options.signal
  });

  if (!response.ok) {
    let message = `chat stream failed (${response.status} ${response.statusText})`;
    try {
      const payload = await response.json() as { ok?: boolean; error?: { message?: string } };
      if (payload?.error?.message) {
        message = payload.error.message;
      }
    } catch {
      const text = await response.text().catch(() => '');
      if (text.trim()) {
        message = text.trim();
      }
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('chat stream is not readable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalView: ChatTurnView | null = null;

  const handleFrame = (frame: string) => {
    const parsed = parseSseFrame(frame);
    if (!parsed) {
      return;
    }
    if (parsed.event === 'ready') {
      try {
        const readyPayload = JSON.parse(parsed.data) as {
          sessionKey?: string;
          requestedAt?: string;
        };
        options.onReady?.({
          event: 'ready',
          sessionKey: String(readyPayload.sessionKey ?? ''),
          requestedAt: String(readyPayload.requestedAt ?? '')
        });
      } catch {
        // ignore malformed ready event payload
      }
      return;
    }
    if (parsed.event === 'delta') {
      try {
        const deltaPayload = JSON.parse(parsed.data) as { delta?: string };
        if (typeof deltaPayload.delta === 'string' && deltaPayload.delta.length > 0) {
          options.onDelta?.({
            event: 'delta',
            delta: deltaPayload.delta
          });
        }
      } catch {
        // ignore malformed delta event payload
      }
      return;
    }
    if (parsed.event === 'session_event') {
      try {
        options.onSessionEvent?.({
          event: 'session_event',
          data: JSON.parse(parsed.data)
        });
      } catch {
        // ignore malformed session_event payload
      }
      return;
    }
    if (parsed.event === 'final') {
      finalView = JSON.parse(parsed.data) as ChatTurnView;
      return;
    }
    if (parsed.event === 'error') {
      try {
        const errPayload = JSON.parse(parsed.data) as { message?: string };
        throw new Error(typeof errPayload.message === 'string' && errPayload.message ? errPayload.message : 'chat stream failed');
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('chat stream failed');
      }
    }
  };

  let streamDone = false;
  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) {
      streamDone = true;
      continue;
    }
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      if (frame) {
        handleFrame(frame);
      }
      boundary = buffer.indexOf('\n\n');
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    handleFrame(trailing);
  }

  if (!finalView) {
    throw new Error('chat stream ended without final result');
  }
  return finalView;
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
