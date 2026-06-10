import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
} from "@/shared/lib/api";
import {
  useInstallMarketplaceItem,
  useManageMarketplaceItem,
} from "@/features/marketplace/hooks/use-marketplace";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { t } from "@/shared/lib/i18n";
import { useState } from "react";

export function useMarketplaceItemActions() {
  const installMutation = useInstallMarketplaceItem();
  const manageMutation = useManageMarketplaceItem();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [installingSpecs, setInstallingSpecs] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [managingTargets, setManagingTargets] = useState<
    ReadonlyMap<string, MarketplaceManageAction>
  >(new Map());

  const handleInstall = async (item: MarketplaceItemSummary) => {
    const installSpec = item.install.spec;
    if (installingSpecs.has(installSpec)) {
      return;
    }

    setInstallingSpecs((previous) => new Set(previous).add(installSpec));

    try {
      await installMutation.mutateAsync({
        type: item.type,
        spec: installSpec,
        kind: item.install.kind,
        skill: item.slug,
        installPath: `skills/${item.slug}`,
      });
    } catch {
      // handled in mutation onError
    } finally {
      setInstallingSpecs((previous) => {
        const next = new Set(previous);
        next.delete(installSpec);
        return next;
      });
    }
  };

  const handleManage = async (
    action: MarketplaceManageAction,
    record: MarketplaceInstalledRecord,
  ) => {
    const targetId =
      action === "update"
        ? record.catalogSlug || record.id || record.spec
        : record.id || record.spec;
    if (!targetId || managingTargets.has(targetId)) {
      return;
    }

    if (action === "uninstall") {
      const confirmed = await confirm({
        title: `${t("marketplaceUninstallTitle")} ${targetId}?`,
        description: t("marketplaceUninstallDescription"),
        confirmLabel: t("marketplaceUninstall"),
        variant: "destructive",
      });
      if (!confirmed) {
        return;
      }
    }

    setManagingTargets((previous) => new Map(previous).set(targetId, action));

    try {
      await manageMutation.mutateAsync({
        type: record.type,
        action,
        id: targetId,
        spec: record.spec,
      });
    } finally {
      setManagingTargets((previous) => {
        const next = new Map(previous);
        next.delete(targetId);
        return next;
      });
    }
  };

  return {
    installState: { installingSpecs },
    manageState: { actionsByTarget: managingTargets },
    handleInstall,
    handleManage,
    ConfirmDialog,
  };
}
