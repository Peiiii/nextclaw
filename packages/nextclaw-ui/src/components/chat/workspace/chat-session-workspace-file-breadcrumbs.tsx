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
        "inline-flex h-5 items-center rounded-sm border px-1.5 text-[10px] font-medium leading-none",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-gray-200 bg-gray-50 text-gray-500",
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
    <div
      data-testid="workspace-file-breadcrumbs"
      className="border-b border-gray-200/80 bg-gray-50/55 px-3 py-1.5"
    >
      <div className="flex items-center gap-2.5">
        <div
          title={breadcrumb.fullPath}
          className="min-w-0 flex-1 overflow-x-auto custom-scrollbar"
        >
          <div className="flex min-w-max items-center gap-1 pr-1">
            {breadcrumb.segments.map((segment, index) => (
              <Fragment key={segment.key}>
                <span
                  className={cn(
                    "inline-flex h-5 items-center gap-1 rounded-sm px-1 text-[11px] leading-none",
                    segment.kind === "workspace"
                      ? "bg-primary/8 text-primary"
                      : segment.isCurrent
                        ? "bg-gray-200/70 text-gray-900"
                        : "text-gray-500",
                  )}
                >
                  {segment.kind === "workspace" ? (
                    <FolderTree className="h-3 w-3 shrink-0" />
                  ) : segment.isCurrent ? (
                    <FileCode2 className="h-3 w-3 shrink-0" />
                  ) : null}
                  <span>{segment.label}</span>
                </span>
                {index < breadcrumb.segments.length - 1 ? (
                  <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>

        {breadcrumb.locationLabel || breadcrumb.truncated ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
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
