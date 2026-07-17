import type { UpdateSnapshot } from '@nextclaw/shared';
import { nextclawClient } from './managers/client.manager';

export async function fetchRuntimeUpdate(): Promise<UpdateSnapshot> {
  return await nextclawClient.runtimeUpdate.fetch();
}

export async function checkRuntimeUpdate(): Promise<UpdateSnapshot> {
  return await nextclawClient.runtimeUpdate.check();
}

export async function downloadRuntimeUpdate(): Promise<UpdateSnapshot> {
  return await nextclawClient.runtimeUpdate.download();
}

export async function applyRuntimeUpdate(): Promise<UpdateSnapshot> {
  return await nextclawClient.runtimeUpdate.apply();
}

export async function updateRuntimeUpdateChannel(channel: UpdateSnapshot['channel']): Promise<UpdateSnapshot> {
  return await nextclawClient.runtimeUpdate.updateChannel(channel);
}
