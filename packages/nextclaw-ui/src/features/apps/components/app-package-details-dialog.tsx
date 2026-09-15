import type { AppDataEntry, AppPackageView } from "@nextclaw/client-sdk";
import { HardDrive, Server, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatBytes } from "@/features/app-data";
import { AppDocumentAccessSection } from "@/features/apps/components/app-document-access-section";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export function AppPackageDetailsDialog({
  appPackage,
  disabled,
  displayName,
  displayDescription,
  open,
  onOpenChange,
  onFocusReturn,
  storageUsage,
  storageUsageLoading,
  storageUsageUnavailable,
}: {
  appPackage: AppPackageView;
  disabled: boolean;
  displayName: string;
  displayDescription?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocusReturn: () => void;
  storageUsage?: AppDataEntry["usage"];
  storageUsageLoading: boolean;
  storageUsageUnavailable: boolean;
}) {
  const serviceCount = appPackage.components.filter((component) => component.kind !== "panel").length;
  const storageUsageLabel = resolveStorageUsageLabel(storageUsage, storageUsageLoading, storageUsageUnavailable);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onFocusReturn();
        }}
      >
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>{displayDescription ?? t("appPackagesDetails")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <span>v{appPackage.activeVersion}</span>
          {appPackage.builtIn ? <span>{t("appPackagesBuiltIn")}</span> : null}
          {serviceCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Server className="h-3 w-3" />
              {t("appPackagesLocalService")}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1",
              appPackage.isolation === "full-user" && "text-amber-700 dark:text-amber-300",
            )}
          >
            {appPackage.isolation === "full-user" ? (
              <ShieldAlert className="h-3 w-3" />
            ) : (
              <ShieldCheck className="h-3 w-3" />
            )}
            {appPackage.isolation === "full-user"
              ? t("appPackagesIsolationFullUser")
              : appPackage.isolation === "host-mediated"
                ? t("appPackagesIsolationMediated")
                : t("appPackagesIsolationPanel")}
          </span>
        </div>
        <div
          className="flex min-w-0 items-center gap-1.5 rounded-md bg-muted/35 px-2 py-1 text-xs text-muted-foreground"
          title={appPackage.storage.dataDirectory}
        >
          <HardDrive className="h-3 w-3 shrink-0" />
          <span className="shrink-0">
            {t("appPackagesDataUsage")} {storageUsageLabel}
          </span>
          <code className="min-w-0 truncate font-mono text-xs">{appPackage.storage.dataDirectory}</code>
        </div>
        <AppDocumentAccessSection
          appId={appPackage.id}
          appName={displayName}
          disabled={disabled}
          scopes={appPackage.documentAccess ?? []}
        />
      </DialogContent>
    </Dialog>
  );
}

function resolveStorageUsageLabel(
  usage: AppDataEntry["usage"] | undefined,
  loading: boolean,
  unavailable: boolean,
): string {
  if (usage) return formatBytes(usage.totalBytes);
  if (loading) return t("appPackagesLoading");
  return t(unavailable ? "appPackagesDataUsageUnavailable" : "appPackagesNoDataYet");
}
