import { Button, EmptyState, LoadingState, Notice } from "@nextclaw/personal-agent-ui";
import { workspaceResources } from "@/features/space/managers/workspace-resource.manager";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { FileEditor } from "./file-editor";

export function FileWorkbench({ notesOnly }: { notesOnly: boolean }) {
  const { activeFileId, fileRoutePath, fileBrowserVisible, fileDetails, fileOpenError, openFile, error } = useBiboSpaceStore();
  if (fileRoutePath && !activeFileId) return <div className="bibo-file-workbench">{error ? <><Notice tone="error">{error}</Notice><Button onClick={workspaceResources.retryRoute}>重试打开</Button></> : <LoadingState label="正在打开文件" />}</div>;
  if (notesOnly && (fileBrowserVisible || !activeFileId)) return null;
  if (activeFileId && fileOpenError?.id === activeFileId) return <div className="bibo-file-workbench"><Notice tone="error">{fileOpenError.message}</Notice><Button onClick={() => void openFile(activeFileId, undefined, true, true)}>重试打开</Button></div>;
  if (activeFileId && !fileDetails[activeFileId]) return <div className="bibo-file-workbench"><LoadingState label="正在打开文件" /></div>;
  return <div className="bibo-file-workbench">
    {activeFileId && !fileBrowserVisible ? <FileEditor key={activeFileId} id={activeFileId} notesOnly={notesOnly} defaultPreview={!/\.(md|markdown|mdown)$/i.test(fileDetails[activeFileId]?.path ?? "")} tabId={`bibo-file-tab-${activeFileId}`} />
      : <EmptyState title={notesOnly ? "选一条笔记继续写" : "从目录中选择一个文件"} />}
  </div>;
}
