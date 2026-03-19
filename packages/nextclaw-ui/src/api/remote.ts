import { api } from './client';
import type {
  RemoteAccessView,
  RemoteDoctorView,
  RemoteLoginRequest,
  RemoteServiceAction,
  RemoteServiceActionResult,
  RemoteSettingsUpdateRequest
} from './remote.types';

export async function fetchRemoteStatus(): Promise<RemoteAccessView> {
  const response = await api.get<RemoteAccessView>('/api/remote/status');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function fetchRemoteDoctor(): Promise<RemoteDoctorView> {
  const response = await api.get<RemoteDoctorView>('/api/remote/doctor');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function loginRemote(data: RemoteLoginRequest): Promise<RemoteAccessView> {
  const response = await api.post<RemoteAccessView>('/api/remote/login', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function logoutRemote(): Promise<RemoteAccessView> {
  const response = await api.post<RemoteAccessView>('/api/remote/logout', {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function updateRemoteSettings(data: RemoteSettingsUpdateRequest): Promise<RemoteAccessView> {
  const response = await api.put<RemoteAccessView>('/api/remote/settings', data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function controlRemoteService(action: RemoteServiceAction): Promise<RemoteServiceActionResult> {
  const response = await api.post<RemoteServiceActionResult>(`/api/remote/service/${action}`, {});
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
