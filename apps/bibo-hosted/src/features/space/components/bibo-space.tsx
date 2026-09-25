import { X } from "lucide-react";
import { useEffect } from "react";
import { Button, EmptyState, IconButton, Notice, Select } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore, type BiboView } from "@/features/space/stores/bibo-space.store";
import { CalendarView } from "./calendar-view";
import { Overview } from "./overview-view";
import { Inbox } from "./inbox-view";
import { Tasks } from "./tasks-view";
import { Files } from "./files/files-view";
import { FileEditor } from "./files/file-editor";

function Status() {
  const { loading, saving, error, notice, clearNotice } = useBiboSpaceStore();
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clearNotice, 4000);
    return () => window.clearTimeout(timer);
  }, [notice, clearNotice]);
  return (
    <>
      {(saving || loading) && <Notice tone="loading">{saving ? "正在保存…" : "正在读取…"}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {notice && (
        <Notice tone="success" onDismiss={clearNotice}>
          {notice}
        </Notice>
      )}
    </>
  );
}
export function BiboWorkspace() {
  const { workspaceOpen, workspaceFileId, closeWorkspace, files, fileDetails, openWorkspace, error } = useBiboSpaceStore();
  if (!workspaceOpen) return null;
  const choices = files.filter((file) => file.kind !== "folder");
  const current = workspaceFileId ? fileDetails[workspaceFileId] : null;
  if (current && !choices.some((file) => file.id === current.id)) choices.unshift(current);
  return (
    <aside className="bibo-workspace" aria-label="右侧工作区">
      <div className="bibo-workspace-head">
        <Select
          aria-label="工作区文件"
          value={workspaceFileId ?? ""}
          onChange={(event) => void openWorkspace(event.target.value)}
        >
          <option value="" disabled>
            选择文件
          </option>
          {workspaceFileId && !choices.some((file) => file.id === workspaceFileId) && <option value={workspaceFileId}>所选产物</option>}
          {choices.map((file) => (
            <option key={file.id} value={file.id}>
              {file.path}
            </option>
          ))}
        </Select>
        <IconButton label="关闭工作区" icon={<X />} onClick={closeWorkspace} />
      </div>
      <div className="bibo-workspace-content">
        <Status />
        {workspaceFileId && !current && error ? (
          <div><EmptyState title="暂时无法打开文件" detail="可以重试，或选择另一个文件。" /><Button onClick={() => void openWorkspace(workspaceFileId)}>重试打开</Button></div>
        ) : workspaceFileId ? (
          <FileEditor id={workspaceFileId} compact />
        ) : (
          <EmptyState title="打开一个产物" detail="文件、笔记和 Bibo 的草稿都能在这里并排查看。" />
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
  const { loading, error } = useBiboSpaceStore();
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
  return (
    <div className={`bibo-space-scroll${view !== "overview" ? " is-workspace" : ""}`}>
      <div className="bibo-space-feedback">
        <Status />
        {error && !loading && (
          <Button tone="text" onClick={() => void useBiboSpaceStore.getState().load(view)}>
            重试读取
          </Button>
        )}
      </div>
      {content}
    </div>
  );
}
