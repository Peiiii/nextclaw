import { useState } from "react";
import type { AppPackageView } from "@nextclaw/client-sdk";
import { FolderKey, ShieldCheck, Trash2 } from "lucide-react";
import { useAppDocumentAccessMutation } from "@/features/apps/hooks/use-app-packages";
import { ServerPathPickerDialog } from "@/shared/components/path-picker/server-path-picker-dialog";
import { Button } from "@/shared/components/ui/button";
import { t } from "@/shared/lib/i18n";

type DocumentScope = AppPackageView["documentAccess"][number];

export function AppDocumentAccessSection({
  appId,
  appName,
  disabled,
  scopes,
}: {
  appId: string;
  appName: string;
  disabled: boolean;
  scopes: DocumentScope[];
}) {
  const mutation = useAppDocumentAccessMutation();
  const [activeScopeId, setActiveScopeId] = useState<string | null>(null);
  const [modes, setModes] = useState<Record<string, "read" | "read-write">>({});
  const activeScope = scopes.find((scope) => scope.id === activeScopeId);
  const effectiveMode = activeScope
    ? (modes[activeScope.id] ?? activeScope.effectiveMode ?? "read")
    : "read";

  if (scopes.length === 0) return null;

  const error = mutation.error instanceof Error ? mutation.error.message : null;

  return (
    <section className="border-t border-border/60 bg-muted/10 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <FolderKey className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-foreground">
          {t("appPackagesDocumentAccessTitle")}
        </h3>
      </div>
      <div className="space-y-2">
        {scopes.map((scope) => {
          const selectedMode = modes[scope.id] ?? scope.effectiveMode ?? "read";
          return (
            <div
              key={scope.id}
              className="rounded-lg border border-border/60 bg-card px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <code>{scope.id}</code>
                    <span className="font-normal text-muted-foreground">
                      {scope.status === "ungranted"
                        ? t("appPackagesDocumentAccessUngranted")
                        : scope.status === "unavailable"
                          ? t("appPackagesDocumentAccessUnavailable")
                          : scope.effectiveMode === "read-write"
                            ? t("appPackagesDocumentAccessReadWrite")
                            : t("appPackagesDocumentAccessRead")}
                    </span>
                  </div>
                  {scope.description ? (
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                      {scope.description}
                    </p>
                  ) : null}
                  {scope.grantedPath ? (
                    <code
                      className="mt-1 block truncate text-[10px] text-muted-foreground"
                      title={scope.grantedPath}
                    >
                      {scope.grantedPath}
                    </code>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <label
                    className="sr-only"
                    htmlFor={`${appId}-${scope.id}-mode`}
                  >
                    {t("appPackagesDocumentAccessMode")}
                  </label>
                  <select
                    id={`${appId}-${scope.id}-mode`}
                    value={selectedMode}
                    disabled={disabled || mutation.isPending}
                    onChange={(event) =>
                      setModes((current) => ({
                        ...current,
                        [scope.id]: event.target.value as "read" | "read-write",
                      }))
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="read">
                      {t("appPackagesDocumentAccessRead")}
                    </option>
                    {scope.mode === "read-write" ? (
                      <option value="read-write">
                        {t("appPackagesDocumentAccessReadWrite")}
                      </option>
                    ) : null}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || mutation.isPending}
                    onClick={() => {
                      mutation.reset();
                      setActiveScopeId(scope.id);
                    }}
                  >
                    {scope.granted
                      ? t("appPackagesDocumentAccessReplace")
                      : t("appPackagesDocumentAccessChoose")}
                  </Button>
                  {scope.granted ? (
                    <button
                      type="button"
                      aria-label={t("appPackagesDocumentAccessRevoke")}
                      title={t("appPackagesDocumentAccessRevoke")}
                      disabled={disabled || mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          action: "revoke",
                          appId,
                          scopeId: scope.id,
                        })
                      }
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <ServerPathPickerDialog
        open={Boolean(activeScope)}
        currentPath={activeScope?.grantedPath}
        isSaving={mutation.isPending}
        onOpenChange={(open) => {
          if (!open) setActiveScopeId(null);
        }}
        onConfirm={async (directoryPath) => {
          if (!activeScope) return;
          await mutation.mutateAsync({
            action: "grant",
            appId,
            scopeId: activeScope.id,
            directoryPath,
            mode: effectiveMode,
          });
          setActiveScopeId(null);
        }}
        title={`${t("appPackagesDocumentAccessChooseTitle")} · ${appName}`}
        description={
          activeScope?.description ??
          t("appPackagesDocumentAccessChooseDescription")
        }
        pathLabel={t("appPackagesDocumentAccessPath")}
        confirmLabel={
          activeScope?.granted
            ? t("appPackagesDocumentAccessReplace")
            : t("appPackagesDocumentAccessGrant")
        }
        hint={
          effectiveMode === "read-write"
            ? t("appPackagesDocumentAccessWriteWarning")
            : t("appPackagesDocumentAccessReadHint")
        }
      />
    </section>
  );
}
