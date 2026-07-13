import { Fragment } from "react";
import type { ChatFileOpenActionViewModel } from "@nextclaw/agent-chat-ui";
import { ChevronRight, Folder, Loader2 } from "lucide-react";
import { FileTypeIcon } from "@/shared/components/file-type-icon";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { useServerPathBrowse } from "@/shared/hooks/use-server-path-browse";
import type { ServerPathEntryView } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

function WorkspaceBreadcrumbEntryIcon({
  name,
  kind,
}: {
  name: string;
  kind: ServerPathEntryView["kind"];
}) {
  return kind === "directory" ? (
    <Folder className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
  ) : (
    <FileTypeIcon fileName={name} size="compact" />
  );
}

export function WorkspaceBreadcrumbBrowser({
  browsePath,
  onBrowsePathChange,
  onClose,
  onFileOpen,
}: {
  browsePath: string | null;
  onBrowsePathChange: (path: string) => void;
  onClose: () => void;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
}) {
  const browseQuery = useServerPathBrowse({
    path: browsePath,
    includeFiles: true,
    enabled: Boolean(browsePath),
  });
  const errorMessage = browseQuery.error
    ? browseQuery.error instanceof Error
      ? browseQuery.error.message
      : String(browseQuery.error)
    : null;
  const entries = browseQuery.data?.entries ?? [];

  const openEntry = (entry: ServerPathEntryView) => {
    if (entry.kind === "directory") {
      onBrowsePathChange(entry.path);
      return;
    }

    onFileOpen({
      path: entry.path,
      label: entry.name,
      viewMode: "preview",
    });
    onClose();
  };

  return (
    <div
      data-testid="workspace-breadcrumb-browser"
      className="flex max-h-72 flex-col overflow-hidden"
    >
      <div className="border-b border-gray-200 px-2 py-1">
        <div className="flex min-w-0 flex-wrap items-center gap-0.5 text-[11px] leading-none text-gray-600">
          {browseQuery.data?.breadcrumbs.map((breadcrumb, index) => (
            <Fragment key={breadcrumb.path}>
              <button
                type="button"
                className="h-5 rounded-sm px-1 text-left hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                onClick={() => onBrowsePathChange(breadcrumb.path)}
              >
                {breadcrumb.label}
              </button>
              {index < browseQuery.data.breadcrumbs.length - 1 ? (
                <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-1 py-1">
        {browseQuery.isLoading ? (
          <div className="flex items-center gap-1.5 px-2 py-4 text-[11px] text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("loading")}
          </div>
        ) : errorMessage ? (
          <div className="px-2 py-3 text-[11px] text-rose-600">
            {t("pathBrowseFailed")}: {errorMessage}
          </div>
        ) : entries.length > 0 ? (
          <div className="space-y-0.5">
            {entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={cn(
                  "flex h-6 w-full items-center gap-1.5 rounded-sm px-1.5 text-left text-[11px] text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
                  entry.hidden ? "opacity-65" : null,
                )}
                onClick={() => openEntry(entry)}
              >
                <WorkspaceBreadcrumbEntryIcon
                  kind={entry.kind}
                  name={entry.name}
                />
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                {entry.kind === "directory" ? (
                  <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="px-2 py-4 text-[11px] text-gray-500">
            {t("emptyDirectory")}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
