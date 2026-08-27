import type { RequestService } from "./request.service.js";

export type CapabilityGrantView = {
  subject: { type: string; id: string };
  resource: { type: string; target: unknown };
  access: string[];
  declarationFingerprint: string;
  grantedAt: string;
  lastUsedAt?: string;
};

export type DesktopHostStatusView = {
  online: boolean;
  platform?: string;
  protocolVersion?: number;
  supportedAccess: string[];
  supportedOperations: string[];
  permissions: {
    accessibility: "granted" | "not_granted" | "not_supported" | "unknown";
    screenCapture: "granted" | "not_granted" | "not_supported" | "unknown";
  };
};

export type CapabilityGrantRequestView = Omit<CapabilityGrantView, "grantedAt" | "lastUsedAt">;

export class CapabilityAccessService {
  constructor(private readonly requestService: RequestService) {}

  listDesktopGrants = async (): Promise<CapabilityGrantView[]> =>
    await this.requestService.get<CapabilityGrantView[]>(
      "/api/capability-grants?resourceType=desktop.application",
    );

  grantDesktopAccess = async (
    request: CapabilityGrantRequestView,
  ): Promise<CapabilityGrantView> =>
    await this.requestService.post<CapabilityGrantView>(
      "/api/capability-grants",
      request,
    );

  revokeDesktopAccess = async (
    grant: CapabilityGrantView,
  ): Promise<{ revoked: CapabilityGrantView[] }> =>
    await this.requestService.request<{ revoked: CapabilityGrantView[] }>(
      "/api/capability-grants",
      {
        method: "DELETE",
        body: {
          subject: grant.subject,
          resourceType: grant.resource.type,
          target: grant.resource.target,
          access: grant.access,
        },
      },
    );

  getDesktopStatus = async (): Promise<DesktopHostStatusView> =>
    await this.requestService.get<DesktopHostStatusView>(
      "/api/desktop-host/status",
    );

  requestDesktopPermissions = async (): Promise<DesktopHostStatusView["permissions"]> =>
    await this.requestService.post<DesktopHostStatusView["permissions"]>(
      "/api/desktop-host/permissions/request",
      {},
    );

  openDesktopPermissionSettings = async (): Promise<{ opened: boolean }> =>
    await this.requestService.post<{ opened: boolean }>(
      "/api/desktop-host/permissions/open-settings",
      {},
    );
}
