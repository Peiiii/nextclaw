import type {
  CapabilityGrantRequestView,
  CapabilityGrantView,
} from "@nextclaw/client-sdk";
import { nextclawClient } from "@/shared/lib/api/managers/client.manager";

export class DesktopCapabilityManager {
  getStatus = async () => await nextclawClient.capabilityAccess.getDesktopStatus();

  listGrants = async () => await nextclawClient.capabilityAccess.listDesktopGrants();

  grantAccess = async (request: CapabilityGrantRequestView) =>
    await nextclawClient.capabilityAccess.grantDesktopAccess(request);

  requestSystemPermission = async () =>
    await nextclawClient.capabilityAccess.requestDesktopPermissions();

  openSystemSettings = async () =>
    await nextclawClient.capabilityAccess.openDesktopPermissionSettings();

  revokeGrant = async (grant: CapabilityGrantView) =>
    await nextclawClient.capabilityAccess.revokeDesktopAccess(grant);
}

export const desktopCapabilityManager = new DesktopCapabilityManager();
