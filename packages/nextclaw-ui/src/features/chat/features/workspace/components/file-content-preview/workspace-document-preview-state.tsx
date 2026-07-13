import { t } from "@/shared/lib/i18n";

export function WorkspaceDocumentPreviewState({
  status,
}: {
  status: "loading" | "ready" | "error";
}) {
  if (status === "ready") {
    return null;
  }
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 px-6 text-center text-sm text-muted-foreground">
      {status === "loading"
        ? t("chatWorkspaceLoadingPreview")
        : t("chatWorkspacePreviewFailed")}
    </div>
  );
}
