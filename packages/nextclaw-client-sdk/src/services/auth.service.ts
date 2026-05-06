import type {
  AuthEnabledUpdateRequest,
  AuthLoginRequest,
  AuthPasswordUpdateRequest,
  AuthSetupRequest,
  AuthStatusView
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class AuthService {
  constructor(private readonly requestService: RequestService) {}

  readonly fetchStatus = async (options: { timeoutMs?: number } = {}): Promise<AuthStatusView> => {
    return await this.requestService.get<AuthStatusView>("/api/auth/status", {
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {})
    });
  };

  readonly setup = async (data: AuthSetupRequest): Promise<AuthStatusView> => {
    return await this.requestService.post<AuthStatusView>("/api/auth/setup", data);
  };

  readonly login = async (data: AuthLoginRequest): Promise<AuthStatusView> => {
    return await this.requestService.post<AuthStatusView>("/api/auth/login", data);
  };

  readonly logout = async (): Promise<{ success: boolean }> => {
    return await this.requestService.post<{ success: boolean }>("/api/auth/logout", {});
  };

  readonly updatePassword = async (data: AuthPasswordUpdateRequest): Promise<AuthStatusView> => {
    return await this.requestService.put<AuthStatusView>("/api/auth/password", data);
  };

  readonly updateEnabled = async (data: AuthEnabledUpdateRequest): Promise<AuthStatusView> => {
    return await this.requestService.put<AuthStatusView>("/api/auth/enabled", data);
  };
}
