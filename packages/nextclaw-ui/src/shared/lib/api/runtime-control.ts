import { api } from './client';
import type { RuntimeControlActionResult, RuntimeControlView } from './runtime-control.types';

export async function fetchRuntimeControl(): Promise<RuntimeControlView> {
  const response = await api.get<RuntimeControlView>('/api/runtime/control');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function startRuntimeService(): Promise<RuntimeControlActionResult> {
  const response = await api.post<RuntimeControlActionResult>('/api/runtime/control/start-service', {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function restartRuntimeService(): Promise<RuntimeControlActionResult> {
  const response = await api.post<RuntimeControlActionResult>('/api/runtime/control/restart-service', {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function stopRuntimeService(): Promise<RuntimeControlActionResult> {
  const response = await api.post<RuntimeControlActionResult>('/api/runtime/control/stop-service', {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
