import { copyText } from "@nextclaw/agent-chat-ui";
import {
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FolderPlus,
  LocateFixed,
  MessageSquarePlus,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type {
  RefreshDirectory,
  WorkspaceDirectoryActionTarget,
} from "@/features/chat/features/workspace/hooks/use-workspace-file-actions";
import type { ContextMenuGroup } from "@/shared/components/ui/context-menu/context-menu";
import type { ServerPathEntryView } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";

export async function copyWorkspacePath(path: string) {
  const copied = await copyText(path);
  toast[copied ? "success" : "error"](
    t(copied ? "chatCodeCopied" : "chatWorkspaceCopyPathFailed"),
  );
}

export function buildWorkspaceEntryContextMenuGroups({
  busy,
  downloadUrl,
  entry,
  onAddToChat,
  onCreateFolder,
  onCreateFile,
  onDelete,
  onOpen,
  onRenameRequest,
  onRevealPath,
  onUpload,
  ownCreateTarget,
  parentRefresh,
  relativePath,
}: {
  busy: boolean;
  downloadUrl: string | null;
  entry: ServerPathEntryView;
  onAddToChat?: (entry: ServerPathEntryView, relativePath: string) => void;
  onCreateFolder?: (target: WorkspaceDirectoryActionTarget) => void;
  onCreateFile?: (target: WorkspaceDirectoryActionTarget) => void;
  onDelete?: (entry: ServerPathEntryView, refresh: RefreshDirectory) => void;
  onOpen: () => void;
  onRenameRequest?: () => void;
  onRevealPath?: (path: string) => void;
  onUpload?: (target: WorkspaceDirectoryActionTarget) => void;
  ownCreateTarget: WorkspaceDirectoryActionTarget;
  parentRefresh: RefreshDirectory;
  relativePath: string | null;
}): ContextMenuGroup[] {
  const isDirectory = entry.kind === "directory";
  const openGroup: ContextMenuGroup = {
    key: "open",
    items: [
      {
        key: "open",
        label: t("chatWorkspaceOpen"),
        icon: <ExternalLink className="h-4 w-4" />,
        onSelect: onOpen,
      },
    ],
  };
  const manageGroup: ContextMenuGroup = {
    key: "manage",
    items: isDirectory
      ? [
          ...(onCreateFile
            ? [
                {
                  key: "new-file",
                  label: t("chatWorkspaceNewFile"),
                  icon: <FilePlus2 className="h-4 w-4" />,
                  disabled: busy,
                  restoreFocus: false,
                  onSelect: () => onCreateFile(ownCreateTarget),
                },
              ]
            : []),
          ...(onCreateFolder
            ? [
                {
                  key: "new-folder",
                  label: t("chatWorkspaceNewFolder"),
                  icon: <FolderPlus className="h-4 w-4" />,
                  disabled: busy,
                  restoreFocus: false,
                  onSelect: () => onCreateFolder(ownCreateTarget),
                },
              ]
            : []),
          ...(onUpload
            ? [
                {
                  key: "upload",
                  label: t("chatWorkspaceUploadFilesHere"),
                  icon: <Upload className="h-4 w-4" />,
                  disabled: busy,
                  restoreFocus: false,
                  onSelect: () => onUpload(ownCreateTarget),
                },
              ]
            : []),
        ]
      : [],
  };
  const nextclawGroup: ContextMenuGroup = {
    key: "nextclaw",
    items: [
      ...(relativePath && onAddToChat
        ? [
            {
              key: "add-to-chat",
              label: t("chatWorkspaceAddToChat"),
              icon: <MessageSquarePlus className="h-4 w-4" />,
              restoreFocus: false,
              onSelect: () => onAddToChat(entry, relativePath),
            },
          ]
        : []),
      ...(downloadUrl
        ? [
            {
              key: "download",
              label: t("chatWorkspaceDownloadFile"),
              icon: <Download className="h-4 w-4" />,
              href: downloadUrl,
              download: entry.name,
            },
          ]
        : []),
    ],
  };
  const pathGroup: ContextMenuGroup = {
    key: "path",
    items: [
      ...(onRevealPath
        ? [
            {
              key: "reveal",
              label: t("chatWorkspaceRevealInFileManager"),
              icon: <LocateFixed className="h-4 w-4" />,
              onSelect: () => onRevealPath(entry.path),
            },
          ]
        : []),
      {
        key: "copy-path",
        label: t("chatWorkspaceCopyPath"),
        icon: <Copy className="h-4 w-4" />,
        onSelect: () => void copyWorkspacePath(entry.path),
      },
      ...(relativePath
        ? [
            {
              key: "copy-relative-path",
              label: t("chatWorkspaceCopyRelativePath"),
              icon: <Copy className="h-4 w-4" />,
              onSelect: () => void copyWorkspacePath(relativePath),
            },
          ]
        : []),
    ],
  };
  const renameGroup: ContextMenuGroup = {
    key: "rename",
    items: onRenameRequest
      ? [
          {
            key: "rename",
            label: t("chatWorkspaceRename"),
            icon: <Pencil className="h-4 w-4" />,
            disabled: busy,
            restoreFocus: false,
            onSelect: onRenameRequest,
          },
        ]
      : [],
  };
  const dangerGroup: ContextMenuGroup = {
    key: "danger",
    items: onDelete
      ? [
          {
            key: "delete",
            label: t("chatWorkspaceDelete"),
            icon: <Trash2 className="h-4 w-4" />,
            destructive: true,
            disabled: busy,
            restoreFocus: false,
            onSelect: () => onDelete(entry, parentRefresh),
          },
        ]
      : [],
  };

  return isDirectory
    ? [nextclawGroup, manageGroup, pathGroup, renameGroup, dangerGroup]
    : [openGroup, nextclawGroup, pathGroup, renameGroup, dangerGroup];
}
