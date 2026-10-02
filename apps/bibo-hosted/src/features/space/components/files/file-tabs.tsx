import { ArrowLeft, ChevronDown, FileText, List, PanelLeftOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ActionMenuItem, Button, Dialog, IconButton, Tab, TabList } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { workspaceResources } from "@/features/space/managers/workspace-resource.manager";
import { useWorkspaceUiStore } from "@/features/space/stores/workspace-ui.store";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
import { FileKindIcon } from "./file-kind-icon";
import { FileDirectoryButton } from "./file-breadcrumbs";
import { FileActions } from "./file-actions";

export function FileTabs({ workspace = false }: { workspace?: boolean }) {
  const { files, notes, tabs, activeFileId, workspaceFileId, workspaceResolving, error, fileDetails, fileDrafts, fileOpenError, openFile, openWorkspace, saveFile, view } = useBiboSpaceStore();
  const { closeFile, showFileBrowser } = workspaceResources;
  const { treeCollapsed, toggleTree } = useWorkspaceUiStore();
  const selected = workspace ? workspaceFileId : activeFileId;
  const documentTitle = workspace || view === "notes";
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
  }, [selected, tabs.length, files, fileDetails, documentTitle]);
  const expandTree = () => {
    toggleTree();
    if (window.matchMedia("(max-width: 760px)").matches) showFileBrowser();
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
  const current = selected && !(workspace && workspaceResolving) ? fileDetails[selected] ?? files.find(file => file.id === selected) ?? notes.find(file => file.id === selected) : null;
  const failed = !!error || !!selected && fileOpenError?.id === selected;
  const opening = workspace && workspaceResolving || !!selected && !current && !failed;
  const requestClose = (id: string) => { if (fileDrafts[id]?.dirty) { setFailure(""); setClosing(id); } else closeFile(id); };
  return <>
    {!workspace && treeCollapsed && view === "files" && <div className="file-tree-toggle"><IconButton label="展开目录树" icon={<PanelLeftOpen />} onClick={expandTree} /></div>}
    {!workspace && view !== "notes" && <div className="file-mobile-back"><IconButton label={copy.fileDirectory} icon={<ArrowLeft />} onClick={() => { if (treeCollapsed) toggleTree(); showFileBrowser(); }} /></div>}
    {documentTitle ? <div className="bibo-document-tabs">{current ? <FileActions file={current} label={`文档 ${current.path}`} menuTrigger={<Button className="ui-document-title" tone="quiet" aria-label={`文档 ${current.path}`}><FileText aria-hidden="true" /><span>{current.path.split("/").at(-1)?.replace(/\.(md|markdown|mdown)$/i, "")}{selected && fileDrafts[selected]?.dirty ? " •" : ""}</span><ChevronDown aria-hidden="true" /></Button>}
      leading={!workspace ? <ActionMenuItem onSelect={showFileBrowser}><List size={18} />{copy.backToNotes}</ActionMenuItem> : undefined}
      trailing={selected ? <ActionMenuItem disabled={fileDrafts[selected]?.saving} onSelect={() => requestClose(selected)}><X size={18} />{copy.closeDocument}</ActionMenuItem> : undefined} />
      : <span role="status" aria-busy={opening}>{opening ? copy.fileOpening : failed ? copy.fileOpenFailed : copy.fileSelect}</span>}
    </div> : <TabList className="bibo-file-tabs" ref={tabbar} aria-label={workspace ? copy.fileWorkspaceTabs : copy.fileTabs}>
      {tabs.map((id) => {
        const file = fileDetails[id] ?? files.find((item) => item.id === id) ?? notes.find((item) => item.id === id);
        const label = file?.path ?? (fileOpenError?.id === id ? copy.fileOpenFailed : copy.fileOpening);
        return <div key={id} role="presentation" className={`bibo-file-tab ui-tab-item${selected === id ? " is-active" : ""}`}>
          <Tab id={`${prefix}-${id}`} aria-controls={`${prefix}-${id}-panel`} aria-label={label} aria-busy={!file && fileOpenError?.id !== id} selected={selected === id} label={label} onClick={() => void open(id)}>
            {file && <FileKindIcon file={file} />}<span>{file?.path.split("/").at(-1) ?? label}</span>{fileDrafts[id]?.dirty ? " •" : ""}
          </Tab>
          <IconButton label={`关闭 ${file?.path ?? "文件"}`} icon={<X />} disabled={fileDrafts[id]?.saving}
            onClick={() => { if (fileDrafts[id]?.dirty) { setFailure(""); setClosing(id); } else closeFile(id); }} />
        </div>;
      })}
    </TabList>}
    {!current && (workspace || view !== "notes") && <FileDirectoryButton onOpenFile={(id) => void open(id)} />}
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
