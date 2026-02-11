import { api } from './client';
import type {
  ConfigView,
  ConfigMetaView,
  ProviderConfigView,
  UiConfigView,
  ChannelConfigUpdate,
  ProviderConfigUpdate
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

// PUT /api/config/ui
export async function updateUiConfig(data: UiConfigView): Promise<UiConfigView> {
  const response = await api.put<UiConfigView>('/api/config/ui', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// POST /api/config/reload
export async function reloadConfig(): Promise<{ status: string }> {
  const response = await api.post<{ status: string }>('/api/config/reload', {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
