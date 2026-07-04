import { Fragment, useState } from "react";
import type { ChatFileOpenActionViewModel } from "@nextclaw/agent-chat-ui";
import { ChevronRight, FileCode2, FolderTree } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { WorkspaceBreadcrumbBrowser } from "./chat-session-workspace-file-breadcrumb-browser";
import type {
  WorkspaceFileBreadcrumbSegmentViewModel,
  WorkspaceFileBreadcrumbViewModel,
} from "@/shared/lib/session-project";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

function WorkspaceBreadcrumbMetaChip({ tone = "neutral", value }: { tone?: "neutral" | "warning"; value: string }) {
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

function WorkspaceBreadcrumbSegmentButton({
  onFileOpen,
  segment,
}: {
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  segment: WorkspaceFileBreadcrumbSegmentViewModel;
}) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState<string | null>(segment.browsePath);
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setBrowsePath(segment.browsePath);
    }
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-current={segment.isCurrent ? "page" : undefined}
          className={cn(
            "inline-flex h-5 items-center gap-1 rounded-sm px-1 text-[11px] leading-none transition-colors hover:bg-gray-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            segment.kind === "workspace"
              ? "bg-primary/8 text-primary hover:bg-primary/12"
              : segment.isCurrent
                ? "bg-gray-200/70 text-gray-900"
                : "text-gray-500",
          )}
          disabled={!segment.browsePath}
        >
          {segment.kind === "workspace" ? (
            <FolderTree className="h-3 w-3 shrink-0" />
          ) : segment.isCurrent ? (
            <FileCode2 className="h-3 w-3 shrink-0" />
          ) : null}
          <span>{segment.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-testid="workspace-breadcrumb-popover"
        className="w-[22rem] rounded-md p-0"
        align="start"
      >
        <WorkspaceBreadcrumbBrowser
          browsePath={browsePath}
          onBrowsePathChange={setBrowsePath}
          onClose={() => setOpen(false)}
          onFileOpen={onFileOpen}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ChatSessionWorkspaceFileBreadcrumbs({
  breadcrumb,
  onFileOpen,
}: {
  breadcrumb: WorkspaceFileBreadcrumbViewModel;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
}) {
  return (
    <div
      data-testid="workspace-file-breadcrumbs"
      title={breadcrumb.fullPath}
      className="workspace-horizontal-scrollbar overflow-x-auto overflow-y-hidden border-b border-gray-200/80 bg-gray-50/55"
    >
      <div
        data-testid="workspace-file-breadcrumb-scroll"
        className="flex min-w-max items-center gap-2.5 px-3 py-1.5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 pr-1">
          {breadcrumb.segments.map((segment, index) => (
            <Fragment key={segment.key}>
              <WorkspaceBreadcrumbSegmentButton
                segment={segment}
                onFileOpen={onFileOpen}
              />
              {index < breadcrumb.segments.length - 1 ? (
                <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
              ) : null}
            </Fragment>
          ))}
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
