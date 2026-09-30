import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, SquarePen } from "lucide-react";
import { Button, ConfirmDialog, IconButton, LoadingState, Markdown, MarkdownEditor, Notice, SegmentedControl } from "@nextclaw/personal-agent-ui";
import { FileActions } from "./file-actions";
import { FileDocumentTools } from "./file-document-tools";
import { FileDocumentManager, type FileDocumentView } from "@/features/space/managers/file-document.manager";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { workspaceResources } from "@/features/space/managers/workspace-resource.manager";
import { FileBreadcrumbs } from "./file-breadcrumbs";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
export const FileEditorHeader = createContext<HTMLElement | null>(null);

export function FileEditor({ id, compact = false, notesOnly = false, defaultPreview = false, initialSource = false, tabId, preview: selectedPreview, onPreviewChange }: { id: string; compact?: boolean; notesOnly?: boolean; defaultPreview?: boolean; initialSource?: boolean; tabId?: string; preview?: boolean; onPreviewChange?: (preview: boolean) => void }) {
  const headerContainer = useContext(FileEditorHeader);
  const { fileDetails, fileDrafts, createdFileId, draftStorageError, editFile, saveFile, resolveFileConflict, openWorkspace, openFile, uploadImage } = useBiboSpaceStore();
  const [localPreview, setLocalPreview] = useState(defaultPreview);
  const [source, setSource] = useState(initialSource || selectedPreview === false);
  const [editorOpened, setEditorOpened] = useState(selectedPreview === false || !defaultPreview);
  const previewScroll = useRef(0);
  const preview = selectedPreview ?? localPreview;
  const setPreview = onPreviewChange ?? setLocalPreview;
  const [recovery, setRecovery] = useState<"reload" | "overwrite" | null>(null);
  const [failure, setFailure] = useState("");
  const [documentView, setDocumentView] = useState<FileDocumentView | null>(null);
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null);
  const [documentManager] = useState(() => new FileDocumentManager(setDocumentView));
  useEffect(() => () => documentManager.destroy(), [documentManager]);
  const recover = async () => {
    if (!recovery) return;
    setFailure("");
    await resolveFileConflict(id, recovery);
    const state = useBiboSpaceStore.getState();
    if (state.fileDrafts[id]?.error || state.fileDrafts[id]?.conflict) setFailure(state.fileDrafts[id]?.error || "文件再次发生变化，你的草稿仍保留。请重试。");
    else setRecovery(null);
  };
  const detail = fileDetails[id];
  const draft = fileDrafts[id];
  if (!detail || !draft) return <LoadingState label="正在打开文件" />;
  const restricted = Boolean(detail.preview);
  const html = /\.(html?|svg)$/i.test(detail.path);
  const markdown = /\.(md|markdown|mdown)$/i.test(detail.path);
  const changeMode = (mode: string) => {
    if (mode !== "preview") setSource(mode === "source");
    if (mode !== "preview") setEditorOpened(true);
    setPreview(mode === "preview");
  };
  const framed = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"><style>body{margin:18px;font:14px/1.7 sans-serif;color:#29312a}</style>${draft.content}`;
  const tools = <div className="file-editor-tools">
    <div ref={setToolbarContainer} />
    {!restricted && !markdown && (notesOnly ? <IconButton label={preview ? copy.fileEdit : copy.filePreview} icon={preview ? <SquarePen /> : <Eye />} onClick={() => changeMode(preview ? "edit" : "preview")} /> : <SegmentedControl
      label="文件模式" value={preview ? "preview" : source && markdown ? "source" : "edit"}
      options={[{ value: "preview", label: copy.filePreview }, { value: "edit", label: copy.fileEdit }, ...(source && markdown ? [{ value: "source", label: copy.fileSource }] : [])]}
      onChange={changeMode} />)}
    {!restricted && (draft.dirty || draft.saving) && <IconButton label={draft.saving ? copy.fileSaving : copy.fileSave} icon={<Check />} disabled={draft.saving} onClick={() => void saveFile(id)} />}
    {!restricted && markdown && (preview || !source) && <FileDocumentTools manager={documentManager} view={documentView ?? documentManager.initial} />}
    <FileActions key={id} file={detail} label="文件操作" onSource={!restricted && markdown && !source ? () => changeMode("source") : undefined} onBody={!restricted && markdown && source ? () => changeMode("edit") : undefined} />
  </div>;
  return (
    <div ref={element => { if (element) documentManager.bind(element); }} className={`bibo-file-editor${compact ? " is-compact" : ""}${notesOnly ? " is-note-editor" : ""}`} role={tabId ? "tabpanel" : undefined} id={tabId ? `${tabId}-panel` : undefined} aria-labelledby={tabId} onKeyDown={(event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        const latest = useBiboSpaceStore.getState().fileDrafts[id];
        if (latest?.dirty && !latest.saving) void saveFile(id);
      }
    }}>
      <h2 className="visually-hidden">{detail.path.split("/").at(-1)}</h2>
      {headerContainer && createPortal(tools, headerContainer)}
      <div className="bibo-file-editor-head">
        <div className="file-editor-location"><FileBreadcrumbs path={detail.path} onOpenFile={(id) => void (compact ? openWorkspace(id) : openFile(id))} /></div>
        {!headerContainer && tools}
      </div>
      {draftStorageError && <Notice tone="error">{draftStorageError}</Notice>}
      {draft.error && <Notice tone="error">{draft.error}</Notice>}
      {detail.preview && <p className="file-preview-notice" role="status">{detail.preview.binary ? copy.fileBinaryPreview : copy.filePreviewReadOnly}（{copy.fileByteCount.replace("{count}", detail.preview.totalBytes.toLocaleString())}）</p>}
      {!restricted && draft.conflict && (
        <div className="file-conflict" role="alert">
          <span>文件已在别处更新。你的修改仍保留在这里。</span>
          <div>
            <Button tone="secondary" disabled={draft.saving} onClick={() => { setFailure(""); setRecovery("reload"); }}>读取最新版本</Button>
            <Button tone="text" disabled={draft.saving} onClick={() => { setFailure(""); setRecovery("overwrite"); }}>用当前草稿覆盖</Button>
          </div>
        </div>
      )}
      {restricted && !detail.preview?.binary && <pre className="bibo-file-preview-text">{detail.content}</pre>}
      {!restricted && preview && (
        html ? (
          <iframe className="bibo-file-preview-frame" title={`预览 ${detail.path}`} sandbox="" srcDoc={framed} />
        ) : (
          <div className="bibo-file-preview-markdown" ref={(element) => { if (element) element.scrollTop = previewScroll.current * Math.max(0, element.scrollHeight - element.clientHeight); }} onScroll={(event) => { const element = event.currentTarget; previewScroll.current = element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight); }}>
            <Markdown document text={draft.content} resolveResourceHref={workspaceResources.href} />
          </div>
        )
      )}
      {!restricted && (editorOpened || !preview) && <div className="bibo-file-editor-surface" hidden={preview}>
        <MarkdownEditor autoFocus={createdFileId === id} toolbarContainer={toolbarContainer} value={draft.content} onChange={(value) => editFile(id, value)} source={source || !markdown} active={!preview} label={`${copy.fileEdit} ${detail.path}`} labels={copy.markdownEditor} uploadImage={uploadImage} scrollProgress={previewScroll.current} onScrollProgress={(progress) => { if (!preview) previewScroll.current = progress; }} />
      </div>}
      <div className="bibo-file-editor-status" role="status" aria-live="polite" title={draft.dirty ? copy.fileUnsaved : `已保存 · v${draft.version}`}>
        <span>{draft.saving ? copy.fileSaving : draft.conflict ? copy.fileConflict : draft.error ? copy.fileSaveFailed : draft.dirty ? copy.fileUnsaved : copy.fileSaved}</span>
        {draft.dirty && !draftStorageError && <span>{copy.fileDraftProtected}</span>}
      </div>
      <ConfirmDialog open={recovery !== null} onOpenChange={(open) => { if (!open) setRecovery(null); }}
        title={recovery === "reload" ? "读取最新版本？" : "覆盖服务器内容？"}
        description={recovery === "reload" ? "当前未保存的修改将被放弃，替换为服务器最新版本。" : "将使用当前草稿覆盖服务器最新内容；如果期间再次发生修改，保存仍会被阻止。"}
        cancelLabel="取消" confirmLabel={recovery === "reload" ? "放弃修改并读取" : "确认覆盖"}
        busyLabel="正在处理…" busy={draft.saving} error={failure} onConfirm={() => void recover()} />
    </div>
  );
}
