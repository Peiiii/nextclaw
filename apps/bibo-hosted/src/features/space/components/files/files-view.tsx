import { useState } from "react";
import type { BiboFile } from "@nextclaw/bibo-client";
import {
  EmptyState,
  IconButton,
  ListRow,
} from "@nextclaw/personal-agent-ui";
import { Plus } from "lucide-react";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { day } from "@/features/space/utils/date-format.utils";
import { FileTree } from "./file-tree";
import { FileWorkbench } from "./file-workbench";
import { CreateFileDialog } from "./create-file-dialog";
export function Files({ notesOnly }: { notesOnly: boolean }) {
  const {
    files,
    treeCollapsed,
    activeFileId,
    openFile,
    fileBrowserVisible,
    treeWidth,
  } = useBiboSpaceStore();
  const [kind, setKind] = useState<BiboFile["kind"]>(
    notesOnly ? "note" : "document"
  );
  const [parent, setParent] = useState("");
  const [creating, setCreating] = useState(false);
  const all = notesOnly ? files.filter((file) => file.kind === "note") : files;
  return (
    <div className="bibo-page workspace-page bibo-files-page">
      {creating && <CreateFileDialog parent={parent} initialKind={kind} notesOnly={notesOnly} onClose={() => setCreating(false)} />}
      <div
        style={
          notesOnly
            ? undefined
            : {
                gridTemplateColumns: `${
                  treeCollapsed ? 46 : treeWidth
                }px minmax(0, 1fr)`,
              }
        }
        className={`bibo-files-layout${
          fileBrowserVisible ? " is-browser-visible" : " is-content-visible"
        }${treeCollapsed && !notesOnly ? " is-tree-collapsed" : ""}`}
      >
        {!notesOnly && (
          <FileTree
            onCreate={(path, kind) => {
              setParent(path);
              setKind(kind ?? "document");
              setCreating(true);
            }}
          />
        )}
        {notesOnly && (
          <aside className="bibo-note-list">
            <div className="bibo-pane-label">
              <span>全部笔记 · {all.length}</span>
              <IconButton
                label="新笔记"
                icon={<Plus />}
                onClick={() => {
                  setParent(
                    files.some(
                      (file) => file.kind === "folder" && file.path === "笔记"
                    )
                      ? "笔记"
                      : ""
                  );
                  setKind("note");
                      setCreating(true);
                }}
              />
            </div>
            {all.map((file) => (
              <ListRow
                key={file.id}
                selected={activeFileId === file.id}
                onClick={() => void openFile(file.id)}
              >
                <strong>{file.path.split("/").at(-1)}</strong>
                <small>{day(file.updatedAt)}</small>
              </ListRow>
            ))}
            {all.length === 0 && (
              <EmptyState
                title="第一条笔记"
                detail="写下一个想法，它会自动出现在文件里。"
              />
            )}
          </aside>
        )}
        <FileWorkbench notesOnly={notesOnly} />
      </div>
    </div>
  );
}
