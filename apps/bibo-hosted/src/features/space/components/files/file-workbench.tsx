import { PanelLeftOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, EmptyState, IconButton } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { FileEditor } from "./file-editor";
import { FileKindIcon } from "./file-kind-icon";
export function FileWorkbench({ notesOnly, toggleControlRef, onToggleTree }: { notesOnly: boolean; toggleControlRef: React.RefObject<HTMLButtonElement>; onToggleTree: () => void }) {
  const { files, tabs, activeFileId, fileDetails, fileDrafts, openFile, closeFile, saveFile, showFileBrowser, treeCollapsed } =
    useBiboSpaceStore();
  const [closing, setClosing] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  const cancel = useRef<HTMLButtonElement>(null);
  const tabbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = tabbar.current;
    if (!bar) return;
    const reveal = () => bar.querySelector(".is-active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [activeFileId, tabs.length, files, fileDetails]);
  const saveAndClose = async () => {
    if (!closing) return;
    setFailure("");
    await saveFile(closing);
    const state = useBiboSpaceStore.getState();
    if (state.fileDrafts[closing]?.dirty) {
      setFailure(state.error || "文件尚未保存，请取消关闭并处理文件中的版本冲突。");
      return;
    }
    closeFile(closing);
    setClosing(null);
  };
  return (
    <div className="bibo-file-workbench">
      <div className={`file-tabbar${tabs.length || (!notesOnly && treeCollapsed) ? "" : " is-empty"}`}>
        {!notesOnly && treeCollapsed && <div className="file-tree-toggle"><IconButton ref={toggleControlRef} label="展开目录树" icon={<PanelLeftOpen />} onClick={onToggleTree} /></div>}
        <div className="file-mobile-back">
          <Button tone="text" onClick={() => { if (treeCollapsed && !notesOnly) onToggleTree(); showFileBrowser(); }}>
            ← {notesOnly ? "全部笔记" : "目录"}
          </Button>
        </div>
        <div className="bibo-file-tabs" ref={tabbar}>
          {tabs.map((id) => {
            const file = fileDetails[id] ?? files.find((item) => item.id === id);
            return (
              <div key={id} className={`bibo-file-tab${activeFileId === id ? " is-active" : ""}`}>
                <button title={file?.path} onClick={() => void openFile(id)}>
                  {file && <FileKindIcon file={file} />}
                  <span>{file?.path.split("/").at(-1) ?? "已删除"}</span>
                  {fileDrafts[id]?.dirty ? " •" : ""}
                </button>
                <IconButton label={`关闭 ${file?.path ?? "文件"}`} icon={<X />} disabled={fileDrafts[id]?.saving}
                  onClick={() => { if (fileDrafts[id]?.dirty) { setFailure(""); setClosing(id); } else closeFile(id); }} />
              </div>
            );
          })}
        </div>
      </div>
      {activeFileId ? (
        <>
          <FileEditor id={activeFileId} />
        </>
      ) : (
        <EmptyState title={notesOnly ? "选一条笔记继续写" : "从目录中选择一个文件"} />
      )}
      <Dialog open={closing !== null} onOpenChange={(open) => { if (!open) setClosing(null); }}
        title="保存文件修改？" description={closing ? fileDetails[closing]?.path : undefined}
        closeLabel="取消关闭" busy={closing ? fileDrafts[closing]?.saving : false} initialFocusRef={cancel}>
        <p className="ui-overlay__hint">这份文件有未保存的修改。</p>
        {failure && <p role="alert" className="ui-overlay__error">{failure}</p>}
        <div className="ui-overlay__actions">
          <Button ref={cancel} disabled={!!closing && fileDrafts[closing]?.saving} onClick={() => setClosing(null)}>取消</Button>
          <Button tone="danger" disabled={!!closing && fileDrafts[closing]?.saving} onClick={() => { if (closing) closeFile(closing, true); setClosing(null); }}>放弃修改</Button>
          <Button tone="primary" disabled={!!closing && fileDrafts[closing]?.saving} onClick={() => void saveAndClose()}>保存并关闭</Button>
        </div>
      </Dialog>
    </div>
  );
}
