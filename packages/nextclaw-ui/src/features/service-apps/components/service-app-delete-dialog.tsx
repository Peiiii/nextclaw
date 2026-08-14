import { useEffect, useRef } from "react";
import type { AppDataEntry } from "@nextclaw/client-sdk";
import { LoaderCircle } from "lucide-react";
import { AppDataRemovalChoice, AppStorageUsageDetails } from "@/features/app-data";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { t } from "@/shared/lib/i18n";

export function ServiceAppDeleteDialog({
  appId,
  appTitle,
  dataEntry,
  dataLoading,
  deleteError,
  deletePending,
  open,
  purgeData,
  onDelete,
  onOpenChange,
  onPurgeDataChange,
}: {
  appId: string;
  appTitle: string;
  dataEntry?: AppDataEntry;
  dataLoading: boolean;
  deleteError: unknown;
  deletePending: boolean;
  open: boolean;
  purgeData: boolean;
  onDelete: (appId: string, purgeData: boolean, onSuccess: () => void) => void;
  onOpenChange: (open: boolean) => void;
  onPurgeDataChange: (purgeData: boolean) => void;
}) {
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (deleteError) errorRef.current?.focus();
  }, [deleteError]);

  const close = () => onOpenChange(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !deletePending && onOpenChange(nextOpen)}
    >
      <DialogContent
        className="max-w-md [&>:last-child]:hidden"
        onEscapeKeyDown={(event) => deletePending && event.preventDefault()}
        onInteractOutside={(event) => deletePending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("serviceAppsDeleteConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("serviceAppsDeleteConfirmDescription")} {appTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-2">
          <AppDataRemovalChoice
            checked={!purgeData}
            description={t("serviceAppsKeepDataDescription")}
            label={t("appPackagesKeepData")}
            onClick={() => onPurgeDataChange(false)}
          />
          <AppDataRemovalChoice
            checked={purgeData}
            destructive
            disabled={!dataEntry || dataLoading}
            description={t("serviceAppsDeleteDataDescription")}
            label={t("appPackagesDeleteData")}
            onClick={() => onPurgeDataChange(true)}
          />
        </div>
        {dataEntry ? (
          <div className="mt-3">
            <AppStorageUsageDetails storage={dataEntry.storage} usage={dataEntry.usage} />
          </div>
        ) : (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            {dataLoading ? t("appPackagesLoading") : t("serviceAppsDataUnavailable")}
          </p>
        )}
        {deleteError ? (
          <p
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="mt-3 text-xs text-destructive"
          >
            {deleteError instanceof Error ? deleteError.message : t("appPackagesActionFailed")}
          </p>
        ) : null}
        <DialogFooter className="mt-5 gap-2 sm:gap-0">
          <Button
            autoFocus
            type="button"
            variant="outline"
            disabled={deletePending}
            onClick={close}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant={purgeData ? "destructive" : "default"}
            disabled={deletePending || (purgeData && !dataEntry)}
            onClick={() => onDelete(appId, purgeData, close)}
          >
            {deletePending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {purgeData ? t("appDataDeletePermanently") : t("serviceAppsDelete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
