import type { UpdatePreferences, UpdateSnapshot } from '@nextclaw/kernel';
import { api } from './client';

export async function fetchRuntimeUpdate(): Promise<UpdateSnapshot> {
  const response = await api.get<UpdateSnapshot>('/api/runtime/update');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function checkRuntimeUpdate(): Promise<UpdateSnapshot> {
  const response = await api.post<UpdateSnapshot>('/api/runtime/update/check', {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function downloadRuntimeUpdate(): Promise<UpdateSnapshot> {
  const response = await api.post<UpdateSnapshot>('/api/runtime/update/download', {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function applyRuntimeUpdate(): Promise<UpdateSnapshot> {
  const response = await api.post<UpdateSnapshot>('/api/runtime/update/apply', {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function updateRuntimeUpdatePreferences(preferences: Partial<UpdatePreferences>): Promise<UpdateSnapshot> {
  const response = await api.put<UpdateSnapshot>('/api/runtime/update/preferences', preferences);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function updateRuntimeUpdateChannel(channel: UpdateSnapshot['channel']): Promise<UpdateSnapshot> {
  const response = await api.put<UpdateSnapshot>('/api/runtime/update/channel', { channel });
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
