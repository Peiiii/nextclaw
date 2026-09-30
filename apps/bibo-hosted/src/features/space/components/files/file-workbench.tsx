import { EmptyState } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { FileEditor } from "./file-editor";

export function FileWorkbench({ notesOnly }: { notesOnly: boolean }) {
  const { activeFileId } = useBiboSpaceStore();
  return <div className="bibo-file-workbench">
    {activeFileId ? <FileEditor key={activeFileId} id={activeFileId} notesOnly={notesOnly} defaultPreview={!notesOnly} tabId={`bibo-file-tab-${activeFileId}`} />
      : <EmptyState title={notesOnly ? "选一条笔记继续写" : "从目录中选择一个文件"} />}
  </div>;
}
