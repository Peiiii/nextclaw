import { Fragment } from "react";
import { ChevronRight, FileCode2, FolderTree } from "lucide-react";
import type { WorkspaceFileBreadcrumbViewModel } from "@/lib/session-project/workspace-file-breadcrumb";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function WorkspaceBreadcrumbMetaChip({
  tone = "neutral",
  value,
}: {
  tone?: "neutral" | "warning";
  value: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-gray-200 bg-white text-gray-500",
      )}
    >
      {value}
    </span>
  );
}

export function ChatSessionWorkspaceFileBreadcrumbs({
  breadcrumb,
}: {
  breadcrumb: WorkspaceFileBreadcrumbViewModel;
}) {
  return (
    <div className="border-b border-gray-200/80 bg-gradient-to-b from-gray-50/90 to-white px-3 py-2.5">
      <div className="flex items-start gap-3">
        <div
          title={breadcrumb.fullPath}
          className="min-w-0 flex-1 overflow-x-auto custom-scrollbar"
        >
          <div className="flex min-w-max items-center gap-1.5 pr-1">
            {breadcrumb.segments.map((segment, index) => (
              <Fragment key={segment.key}>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium",
                    segment.kind === "workspace"
                      ? "bg-primary/10 text-primary"
                      : segment.isCurrent
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-500",
                  )}
                >
                  {segment.kind === "workspace" ? (
                    <FolderTree className="h-3.5 w-3.5 shrink-0" />
                  ) : segment.isCurrent ? (
                    <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                  ) : null}
                  <span>{segment.label}</span>
                </span>
                {index < breadcrumb.segments.length - 1 ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>

        {breadcrumb.locationLabel || breadcrumb.truncated ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {breadcrumb.locationLabel ? (
              <WorkspaceBreadcrumbMetaChip value={breadcrumb.locationLabel} />
            ) : null}
            {breadcrumb.truncated ? (
              <WorkspaceBreadcrumbMetaChip
                tone="warning"
                value={t("chatWorkspacePreviewTruncated")}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
