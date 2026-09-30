import { ArrowLeft, PanelLeftOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, IconButton, Tab, TabList } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
import { FileKindIcon } from "./file-kind-icon";
import { FileDirectoryButton } from "./file-breadcrumbs";

export function FileTabs({ workspace = false }: { workspace?: boolean }) {
  const { files, tabs, activeFileId, workspaceFileId, fileDetails, fileDrafts, openFile, openWorkspace, closeFile, saveFile, showFileBrowser, treeCollapsed, toggleTree, view } = useBiboSpaceStore();
  const selected = workspace ? workspaceFileId : activeFileId;
  const prefix = workspace ? "bibo-workspace-file-tab" : "bibo-file-tab";
  const open = workspace ? openWorkspace : openFile;
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
  }, [selected, tabs.length, files, fileDetails]);
  const expandTree = () => {
    toggleTree(); showFileBrowser();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[aria-label="收起目录树"]')?.focus());
  };
  const saveAndClose = async () => {
    if (!closing) return;
    setFailure("");
    await saveFile(closing);
    const state = useBiboSpaceStore.getState();
    if (state.fileDrafts[closing]?.dirty) {
      setFailure(state.fileDrafts[closing]?.error || "文件还有未保存的修改，请取消关闭后检查编辑内容或版本冲突。");
      return;
    }
    closeFile(closing); setClosing(null);
  };
  return <>
    {!workspace && treeCollapsed && view === "files" && <div className="file-tree-toggle"><IconButton label="展开目录树" icon={<PanelLeftOpen />} onClick={expandTree} /></div>}
    {!workspace && <div className={`file-mobile-back${view === "notes" ? " is-notes-back" : ""}`}><IconButton label={view === "notes" ? copy.backToNotes : copy.fileDirectory} icon={<ArrowLeft />} onClick={() => { if (treeCollapsed && view === "files") toggleTree(); showFileBrowser(); }} /></div>}
    <TabList className="bibo-file-tabs" ref={tabbar} aria-label={workspace ? copy.fileWorkspaceTabs : copy.fileTabs}>
      {tabs.map((id) => {
        const file = fileDetails[id] ?? files.find((item) => item.id === id);
        return <div key={id} role="presentation" className={`bibo-file-tab ui-tab-item${selected === id ? " is-active" : ""}`}>
          <Tab id={`${prefix}-${id}`} aria-controls={`${prefix}-${id}-panel`} aria-label={file?.path ?? "已删除"} selected={selected === id} label={file?.path ?? "已删除"} onClick={() => void open(id)}>
            {file && <FileKindIcon file={file} />}<span>{(file?.path.split("/").at(-1) ?? "已删除").replace(view === "notes" ? /\.(md|markdown|mdown)$/i : /$^/, "")}</span>{fileDrafts[id]?.dirty ? " •" : ""}
          </Tab>
          <IconButton label={`关闭 ${file?.path ?? "文件"}`} icon={<X />} disabled={fileDrafts[id]?.saving}
            onClick={() => { if (fileDrafts[id]?.dirty) { setFailure(""); setClosing(id); } else closeFile(id); }} />
        </div>;
      })}
    </TabList>
    {(workspace || view !== "notes") && <FileDirectoryButton onOpenFile={(id) => void open(id)} />}
    <Dialog open={closing !== null} onOpenChange={(value) => { if (!value) setClosing(null); }} title="保存文件修改？" description={closing ? fileDetails[closing]?.path : undefined}
      closeLabel="取消关闭" busy={closing ? fileDrafts[closing]?.saving : false} initialFocusRef={cancel}>
      <p className="ui-overlay__hint">这份文件有未保存的修改。</p>
      {failure && <p role="alert" className="ui-overlay__error">{failure}</p>}
      <div className="ui-overlay__actions">
        <Button ref={cancel} disabled={!!closing && fileDrafts[closing]?.saving} onClick={() => setClosing(null)}>取消</Button>
        <Button tone="danger" disabled={!!closing && fileDrafts[closing]?.saving} onClick={() => { if (closing) closeFile(closing, true); setClosing(null); }}>放弃修改</Button>
        <Button tone="primary" disabled={!!closing && fileDrafts[closing]?.saving} onClick={() => void saveAndClose()}>保存并关闭</Button>
      </div>
    </Dialog>
  </>;
}
