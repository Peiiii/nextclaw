import { api } from '@/shared/lib/api/managers/client.manager';
import type {
  PreferenceDeleteResult,
  PreferenceEntryView,
  PreferenceJsonValue,
} from '@/shared/lib/api/preferences/preference.types';

function encodePreferenceKey(key: string): string {
  return encodeURIComponent(key);
}

export async function fetchPreference(key: string): Promise<PreferenceEntryView> {
  const response = await api.get<PreferenceEntryView>(`/api/preferences/${encodePreferenceKey(key)}`);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function updatePreference(
  key: string,
  value: PreferenceJsonValue,
): Promise<PreferenceEntryView> {
  const response = await api.put<PreferenceEntryView>(
    `/api/preferences/${encodePreferenceKey(key)}`,
    { value },
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function deletePreference(key: string): Promise<PreferenceDeleteResult> {
  const response = await api.delete<PreferenceDeleteResult>(`/api/preferences/${encodePreferenceKey(key)}`);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
