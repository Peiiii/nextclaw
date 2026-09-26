import { useRef, useState } from "react";
import type { BiboFile } from "@nextclaw/bibo-client";
import {
  EmptyState,
  Button,
  IconButton,
  ListRow,
  Input,
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
    notes,
    cursors,
    moreLoading,
    loading,
    error,
    loadMore,
    treeCollapsed,
    toggleTree,
    showFileBrowser,
    activeFileId,
    openFile,
    fileBrowserVisible,
    treeWidth,
    noteQuery,
    searchNotes,
  } = useBiboSpaceStore();
  const [kind, setKind] = useState<BiboFile["kind"]>(
    notesOnly ? "note" : "document"
  );
  const [parent, setParent] = useState("");
  const [creating, setCreating] = useState(false);
  const collapseControl = useRef<HTMLButtonElement>(null);
  const expandControl = useRef<HTMLButtonElement>(null);
  const toggleDirectory = () => {
    toggleTree();
    if (treeCollapsed) showFileBrowser();
    requestAnimationFrame(() => {
      (treeCollapsed ? collapseControl : expandControl).current?.focus();
    });
  };
  const all = notesOnly ? notes : files;
  return (
    <div className="bibo-page workspace-page bibo-files-page">
      {creating && <CreateFileDialog parent={parent} initialKind={kind} notesOnly={notesOnly} onClose={() => setCreating(false)} />}
      <div
        style={
          notesOnly
            ? undefined
            : {
                gridTemplateColumns: treeCollapsed ? "minmax(0, 1fr)" : `${treeWidth}px minmax(0, 1fr)`,
              }
        }
        className={`bibo-files-layout${
          fileBrowserVisible && (!treeCollapsed || notesOnly) ? " is-browser-visible" : " is-content-visible"
        }${treeCollapsed && !notesOnly ? " is-tree-collapsed" : ""}`}
      >
        {!notesOnly && (
          <FileTree
            toggleControlRef={collapseControl}
            onToggle={toggleDirectory}
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
            <div className="file-tree-search"><Input aria-label="搜索笔记" placeholder="搜索笔记名称" value={noteQuery} onChange={(event) => searchNotes(event.target.value)} /></div>
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
            {all.length === 0 && !loading && !error && (
              <EmptyState title={noteQuery ? "没有匹配的笔记" : "还没有笔记"} />
            )}
            {cursors.notes && <Button tone="text" disabled={moreLoading.notes} onClick={() => void loadMore("notes")}>{moreLoading.notes ? "正在加载…" : "加载更多笔记"}</Button>}
          </aside>
        )}
        <FileWorkbench notesOnly={notesOnly} toggleControlRef={expandControl} onToggleTree={toggleDirectory} />
      </div>
    </div>
  );
}
