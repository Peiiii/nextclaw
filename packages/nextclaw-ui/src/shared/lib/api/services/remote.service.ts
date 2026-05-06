import { nextclawClient } from './client.service';
import type {
  RemoteAccessView,
  RemoteAccountProfileUpdateRequest,
  RemoteBrowserAuthPollRequest,
  RemoteBrowserAuthPollResult,
  RemoteBrowserAuthStartRequest,
  RemoteBrowserAuthStartResult,
  RemoteDoctorView,
  RemoteLoginRequest,
  RemoteServiceAction,
  RemoteServiceActionResult,
  RemoteSettingsUpdateRequest
} from '@/shared/lib/api/remote.types';

export async function fetchRemoteStatus(): Promise<RemoteAccessView> {
  return await nextclawClient.remote.fetchStatus();
}

export async function fetchRemoteDoctor(): Promise<RemoteDoctorView> {
  return await nextclawClient.remote.fetchDoctor();
}

export async function loginRemote(data: RemoteLoginRequest): Promise<RemoteAccessView> {
  return await nextclawClient.remote.login(data);
}

export async function startRemoteBrowserAuth(data: RemoteBrowserAuthStartRequest): Promise<RemoteBrowserAuthStartResult> {
  return await nextclawClient.remote.startBrowserAuth(data);
}

export async function pollRemoteBrowserAuth(data: RemoteBrowserAuthPollRequest): Promise<RemoteBrowserAuthPollResult> {
  return await nextclawClient.remote.pollBrowserAuth(data);
}

export async function logoutRemote(): Promise<RemoteAccessView> {
  return await nextclawClient.remote.logout();
}

export async function updateRemoteAccountProfile(data: RemoteAccountProfileUpdateRequest): Promise<RemoteAccessView> {
  return await nextclawClient.remote.updateAccountProfile(data);
}

export async function updateRemoteSettings(data: RemoteSettingsUpdateRequest): Promise<RemoteAccessView> {
  return await nextclawClient.remote.updateSettings(data);
}

export async function controlRemoteService(action: RemoteServiceAction): Promise<RemoteServiceActionResult> {
  return await nextclawClient.remote.controlService(action);
}
