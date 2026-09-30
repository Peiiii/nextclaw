import { EmptyState } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { FileEditor } from "./file-editor";

export function FileWorkbench({ notesOnly }: { notesOnly: boolean }) {
  const { activeFileId, fileBrowserVisible, fileDetails } = useBiboSpaceStore();
  if (notesOnly && (fileBrowserVisible || !activeFileId || fileDetails[activeFileId]?.kind !== "note")) return null;
  return <div className="bibo-file-workbench">
    {activeFileId ? <FileEditor key={activeFileId} id={activeFileId} notesOnly={notesOnly} defaultPreview={!/\.(md|markdown|mdown)$/i.test(fileDetails[activeFileId]?.path ?? "")} tabId={`bibo-file-tab-${activeFileId}`} />
      : <EmptyState title={notesOnly ? "选一条笔记继续写" : "从目录中选择一个文件"} />}
  </div>;
}
