import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CapabilityGrantView, ProductFeatureControlsView } from "@nextclaw/client-sdk";
import { useFeatureControls } from "@/app/hooks/use-feature-controls";
import { desktopCapabilityManager } from "../managers/desktop-capability.manager";

const STATUS_QUERY_KEY = ["desktop-capability", "status"] as const;
const GRANTS_QUERY_KEY = ["desktop-capability", "grants"] as const;

export function useDesktopCapabilityStatus() {
  return useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: desktopCapabilityManager.getStatus,
  });
}

export function useDesktopCapabilityAvailability(): boolean {
  const featureControls = useFeatureControls();
  return isDesktopAutomationAvailable(featureControls.data);
}

export function isDesktopAutomationAvailable(controls: ProductFeatureControlsView | undefined): boolean {
  return controls?.desktopAutomation.available === true;
}

export function useDesktopCapabilityGrants() {
  return useQuery({
    queryKey: GRANTS_QUERY_KEY,
    queryFn: desktopCapabilityManager.listGrants,
  });
}

export function useRequestDesktopSystemPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: desktopCapabilityManager.requestSystemPermission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
  });
}

export function useOpenDesktopSystemSettings() {
  return useMutation({ mutationFn: desktopCapabilityManager.openSystemSettings });
}

export function useRevokeDesktopGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (grant: CapabilityGrantView) =>
      await desktopCapabilityManager.revokeGrant(grant),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: GRANTS_QUERY_KEY });
    },
  });
}
