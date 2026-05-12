import { nextclawClient } from '../managers/client.manager';
import type { RuntimeControlActionResult, RuntimeControlView } from '@/shared/lib/api/runtime-control.types';

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
