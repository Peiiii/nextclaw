import { X } from "lucide-react";
import { Button, EmptyState, IconButton, LoadingState, Notice } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore, type BiboView } from "@/features/space/stores/bibo-space.store";
import { CalendarView } from "./calendar-view";
import { Overview } from "./overview-view";
import { Inbox } from "./inbox-view";
import { Tasks } from "./tasks-view";
import { Files } from "./files/files-view";
import { FileEditor } from "./files/file-editor";
import { FileTabs } from "./files/file-tabs";
import { biboCopy } from "@/shared/configs/bibo-copy.config";

export function BiboWorkspace() {
  const { workspaceOpen, workspaceResolving, workspaceFileId, workspacePreview, setWorkspacePreview, closeWorkspace, fileDetails, openWorkspace, error, fileOpenError } = useBiboSpaceStore();
  if (!workspaceOpen) return null;
  const current = workspaceFileId ? fileDetails[workspaceFileId] : null;
  const openError = fileOpenError?.id === workspaceFileId ? fileOpenError.message : "";
  return (
    <aside className="bibo-workspace" aria-label="右侧工作区">
      <div className="bibo-workspace-head" data-ui-surface="frame">
        <FileTabs workspace />
        <IconButton label={biboCopy.fileCloseWorkspace} icon={<X />} onClick={closeWorkspace} />
      </div>
      <div className="bibo-workspace-content">
        {(error || openError) && <Notice tone="error">{openError || error}</Notice>}
        {workspaceResolving ? <LoadingState label="正在打开资源" /> : workspaceFileId && !current && (error || openError) ? (
          <div><EmptyState title="暂时无法打开文件" /><Button onClick={() => void openWorkspace(workspaceFileId)}>重试打开</Button></div>
        ) : workspaceFileId ? (
          current ? <FileEditor key={workspaceFileId} id={workspaceFileId} tabId={`bibo-workspace-file-tab-${workspaceFileId}`} compact preview={workspacePreview ?? true} onPreviewChange={setWorkspacePreview} /> : <LoadingState label="正在打开文件" />
        ) : (
          <EmptyState title="选择文件或笔记" />
        )}
      </div>
    </aside>
  );
}

export function BiboSpaceView({
  view,
  onOpenSession,
}: {
  view: BiboView;
  onOpenSession: (id: string) => Promise<void>;
}) {
  const { error, readStatus, feedback } = useBiboSpaceStore();
  if (view === "chat") return null;
  const content = {
    overview: <Overview />,
    inbox: <Inbox onOpenSession={onOpenSession} />,
    calendar: <CalendarView />,
    tasks: <Tasks />,
    notes: <Files notesOnly />,
    files: <Files notesOnly={false} />,
  }[view];
  if (!content) return null;
  // Files and notes keep their own list errors visible beside any open, unsaved editor.
  const status = view === "files" || view === "notes" ? "ready" : readStatus[view] ?? "loading";
  const readState = status === "ready" || view === "calendar" ? content : (
    <div className="bibo-read-state" role={status === "error" ? "alert" : "status"}>
      {status === "error" ? <EmptyState title="暂时无法读取这个页面" detail={error || "请检查连接后重试。"} />
        : <LoadingState label="正在加载页面" />}
      {status === "error" && <Button tone="secondary" onClick={() => void useBiboSpaceStore.getState().load(view)}>重试读取</Button>}
    </div>
  );
  return (
    <div className={`bibo-space-scroll${view !== "overview" ? " is-workspace" : ""}`}>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{feedback.message}</span>
      {status === "ready" && error && <div className="bibo-space-error">
        <Notice tone="error">{error}</Notice>
          <Button tone="text" onClick={() => void useBiboSpaceStore.getState().load(view)}>
            重试读取
          </Button>
      </div>}
      {readState}
    </div>
  );
}
