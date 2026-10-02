import { X } from "lucide-react";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { Button, EmptyState, IconButton, LoadingState, Notice } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore, type BiboView } from "@/features/space/stores/bibo-space.store";
import { FileEditor, FileEditorHeader } from "./files/file-editor";
import { FileTabs } from "./files/file-tabs";
import { biboCopy } from "@/shared/configs/bibo-copy.config";
import { workspaceResources } from "@/features/space/managers/workspace-resource.manager";

const CalendarView = lazy(() => import("./calendar-view").then(module => ({ default: module.CalendarView })));
const Overview = lazy(() => import("./overview-view").then(module => ({ default: module.Overview })));
const Inbox = lazy(() => import("./inbox-view").then(module => ({ default: module.Inbox })));
const Tasks = lazy(() => import("./tasks-view").then(module => ({ default: module.Tasks })));
const Files = lazy(() => import("./files/files-view").then(module => ({ default: module.Files })));

export function BiboWorkspace({ onClose }: { onClose: () => void }) {
  const { workspaceOpen, workspaceResolving, workspaceFileId, workspacePreview, setWorkspacePreview, fileDetails, openWorkspace, error, fileOpenError } = useBiboSpaceStore();
  const panelRef = useRef<HTMLElement>(null);
  const [header, setHeader] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!workspaceOpen && panel.contains(document.activeElement)) {
      panel.parentElement?.querySelector<HTMLButtonElement>(`[aria-label="${biboCopy.workspace}"]`)?.focus();
    }
    panel.inert = !workspaceOpen;
  }, [workspaceOpen]);
  const current = workspaceFileId ? fileDetails[workspaceFileId] : null;
  const openError = fileOpenError?.id === workspaceFileId ? fileOpenError.message : "";
  return (
    <aside ref={panelRef} className="bibo-workspace" aria-label="右侧工作区" aria-hidden={!workspaceOpen}>
      <div className="bibo-workspace-head" data-ui-surface="frame">
        <FileTabs workspace />
        <div className="bibo-file-header-tools" ref={setHeader} />
        <IconButton label={biboCopy.fileCloseWorkspace} icon={<X />} onClick={onClose} />
      </div>
      <div className="bibo-workspace-content">
        <FileEditorHeader.Provider value={header}>
        {(error || openError) && <Notice tone="error">{openError || error}</Notice>}
        {workspaceResolving ? <LoadingState label="正在打开资源" /> : workspaceFileId && !current && (error || openError) ? (
          <div><EmptyState title="暂时无法打开文件" /><Button onClick={() => void openWorkspace(workspaceFileId)}>重试打开</Button></div>
        ) : workspaceFileId ? (
          current ? <FileEditor key={workspaceFileId} id={workspaceFileId} tabId={`bibo-workspace-file-tab-${workspaceFileId}`} compact defaultPreview={!/\.(md|markdown|mdown)$/i.test(current.path)} initialSource={workspacePreview === false} preview={workspacePreview ?? undefined} onPreviewChange={setWorkspacePreview} /> : <LoadingState label="正在打开文件" />
        ) : (
          <EmptyState title="选择文件或笔记" />
        )}
        </FileEditorHeader.Provider>
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
  const { error, readStatus, feedback, selectedTaskId, selectedInboxId, selectedEventId } = useBiboSpaceStore();
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
  const status = view === "files" || view === "notes" || view === "tasks" && selectedTaskId || view === "inbox" && selectedInboxId ? "ready" : readStatus[view] ?? "loading";
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
          <Button tone="text" onClick={() => { if (selectedTaskId || selectedInboxId || selectedEventId) workspaceResources.retryRoute(); else void useBiboSpaceStore.getState().load(view); }}>
            重试读取
          </Button>
      </div>}
      <Suspense fallback={<LoadingState label="正在加载页面" />}>{readState}</Suspense>
    </div>
  );
}
