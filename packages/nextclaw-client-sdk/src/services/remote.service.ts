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
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class RemoteService {
  constructor(private readonly requestService: RequestService) {}

  readonly fetchStatus = async (): Promise<RemoteAccessView> => {
    return await this.requestService.get<RemoteAccessView>("/api/remote/status");
  };

  readonly fetchDoctor = async (): Promise<RemoteDoctorView> => {
    return await this.requestService.get<RemoteDoctorView>("/api/remote/doctor");
  };

  readonly login = async (data: RemoteLoginRequest): Promise<RemoteAccessView> => {
    return await this.requestService.post<RemoteAccessView>("/api/remote/login", data);
  };

  readonly startBrowserAuth = async (
    data: RemoteBrowserAuthStartRequest = {}
  ): Promise<RemoteBrowserAuthStartResult> => {
    return await this.requestService.post<RemoteBrowserAuthStartResult>("/api/remote/auth/start", data);
  };

  readonly pollBrowserAuth = async (
    data: RemoteBrowserAuthPollRequest
  ): Promise<RemoteBrowserAuthPollResult> => {
    return await this.requestService.post<RemoteBrowserAuthPollResult>("/api/remote/auth/poll", data);
  };

  readonly logout = async (): Promise<RemoteAccessView> => {
    return await this.requestService.post<RemoteAccessView>("/api/remote/logout", {});
  };

  readonly updateAccountProfile = async (
    data: RemoteAccountProfileUpdateRequest
  ): Promise<RemoteAccessView> => {
    return await this.requestService.put<RemoteAccessView>("/api/remote/account/profile", data);
  };

  readonly updateSettings = async (data: RemoteSettingsUpdateRequest): Promise<RemoteAccessView> => {
    return await this.requestService.put<RemoteAccessView>("/api/remote/settings", data);
  };

  readonly controlService = async (action: RemoteServiceAction): Promise<RemoteServiceActionResult> => {
    return await this.requestService.post<RemoteServiceActionResult>(`/api/remote/service/${action}`, {});
  };
}
