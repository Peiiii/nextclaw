import { nextclawClient } from '../managers/client.manager';
import type { RuntimeControlActionResult, RuntimeControlView } from '@/shared/lib/api/runtime-control.types';
import type { UiExtensionsView } from '@/shared/lib/api/runtime-control.types';
import { requestApiResponse } from '@/shared/lib/api/managers/client.manager';

export async function fetchRuntimeControl(): Promise<RuntimeControlView> {
  return await nextclawClient.runtimeControl.fetch();
}

export async function startRuntimeService(): Promise<RuntimeControlActionResult> {
  return await nextclawClient.runtimeControl.startService();
}

export async function restartRuntimeService(): Promise<RuntimeControlActionResult> {
  return await nextclawClient.runtimeControl.restartService();
}

export async function stopRuntimeService(): Promise<RuntimeControlActionResult> {
  return await nextclawClient.runtimeControl.stopService();
}

export async function fetchExtensionCatalog(): Promise<UiExtensionsView> {
  const response = await requestApiResponse<UiExtensionsView>('/api/runtime/extensions/catalog');
  if (!response.ok) throw new Error(response.error.message);
  return response.data;
}
