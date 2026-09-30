import { useRef, useState } from "react";
import type { BiboFile } from "@nextclaw/bibo-client";
import {
  EmptyState,
  LoadingState,
  Button,
  ListRow,
  RowActionTray,
  Input,
  Notice,
  NavigationItem,
} from "@nextclaw/personal-agent-ui";
import { FileText, Library, Plus, Search, SquarePen } from "lucide-react";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { day } from "@/features/space/utils/date-format.utils";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
import { FileTree } from "./file-tree";
import { FileWorkbench } from "./file-workbench";
import { FileActions } from "./file-actions";
import { CreateFileDialog } from "./create-file-dialog";

export function NoteNavigation({ onNavigate }: { onNavigate: () => void }) {
  const { notes, files, activeFileId, fileBrowserVisible, openFile, showFileBrowser } = useBiboSpaceStore();
  const [creating, setCreating] = useState(false);
  const parent = files.some(file => file.kind === "folder" && file.path === "笔记") ? "笔记" : "";
  return <nav className="bibo-session-nav" aria-label={copy.notes}>
    <NavigationItem label={copy.newNote} tooltip={false}><button className="bibo-new-chat" onClick={() => setCreating(true)}><SquarePen aria-hidden="true" /><span>{copy.newNote}</span></button></NavigationItem>
    <NavigationItem label={copy.allNotes} selected={fileBrowserVisible} tooltip={false}>
      <button className="bibo-session-item" onClick={() => { showFileBrowser(); onNavigate(); }}><Library />{copy.allNotes}</button>
    </NavigationItem>
    <div className="bibo-session-head bibo-note-nav-heading">{copy.recent}</div>
    {notes.map(file => <NavigationItem key={file.id} label={file.path} selected={!fileBrowserVisible && activeFileId === file.id} truncatedLabel>
      <button className="bibo-session-item" onClick={() => { void openFile(file.id); onNavigate(); }}><FileText /><span className="bibo-session-title">{file.path.split("/").at(-1)?.replace(/\.(md|markdown|mdown)$/i, "")}</span></button>
    </NavigationItem>)}
    {creating && <CreateFileDialog parent={parent} initialKind="note" notesOnly onClose={() => setCreating(false)} />}
  </nav>;
}
export function Files({ notesOnly }: { notesOnly: boolean }) {
  const {
    files,
    notes,
    cursors,
    moreLoading,
    loading,
    error,
    fileOpenError,
    workspaceFileId,
    workspaceOpen,
    loadMore,
    treeCollapsed,
    toggleTree,
    showFileBrowser,
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
  const toggleDirectory = () => {
    toggleTree();
    if (treeCollapsed) showFileBrowser();
    requestAnimationFrame(() => {
      if (treeCollapsed) collapseControl.current?.focus();
      else document.querySelector<HTMLButtonElement>('[aria-label="展开目录树"]')?.focus();
    });
  };
  const all = notesOnly ? notes : files;
  return (
    <div className={`bibo-page workspace-page bibo-files-page${notesOnly ? " is-notes-page" : ""}`}>
      {creating && <CreateFileDialog parent={parent} initialKind={kind} notesOnly={notesOnly} onClose={() => setCreating(false)} />}
      {fileOpenError && (!workspaceOpen || fileOpenError.id !== workspaceFileId) && <Notice tone="error">{fileOpenError.message}</Notice>}
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
          <aside className="bibo-note-list" aria-label={copy.allNotes}>
            <div className="bibo-notes-heading">
              <h1>{copy.allNotes}</h1>
              <div className="bibo-notes-actions">
              <div className="bibo-notes-search"><Search aria-hidden="true" /><Input aria-label={copy.searchNotes} placeholder={copy.search} value={noteQuery} onChange={(event) => searchNotes(event.target.value)} /></div>
              <Button tone="primary"
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
              ><Plus />{copy.newNote}</Button>
              </div>
            </div>
            <div className="bibo-notes-columns"><span>{copy.fileName}</span><span>{copy.lastEdited}</span></div>
            {all.map((file) => (
              <div className="ui-list-row-group ui-row-action-host" key={file.id}>
                <ListRow onClick={() => void openFile(file.id)}>
                  <FileText aria-hidden="true" />
                  <strong>{file.path.split("/").at(-1)?.replace(/\.(md|markdown|mdown)$/i, "")}</strong>
                  <small>{day(file.updatedAt)}</small>
                </ListRow>
                <RowActionTray><FileActions file={file} /></RowActionTray>
              </div>
            ))}
            {all.length === 0 && !loading && !error && (
              <EmptyState title={noteQuery ? "没有匹配的笔记" : "还没有笔记"} />
            )}
            {all.length === 0 && loading && <LoadingState label="正在加载笔记" />}
            {cursors.notes && <Button tone="text" disabled={moreLoading.notes} onClick={() => void loadMore("notes")}>{moreLoading.notes ? "正在加载…" : "加载更多笔记"}</Button>}
          </aside>
        )}
        <FileWorkbench notesOnly={notesOnly} />
      </div>
    </div>
  );
}
