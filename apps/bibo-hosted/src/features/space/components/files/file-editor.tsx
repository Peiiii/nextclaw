import { useState } from "react";
import { Button, ConfirmDialog, LoadingState, Markdown, Notice, SegmentedControl } from "@nextclaw/personal-agent-ui";
import { FileActions } from "./file-actions";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { workspaceResources } from "@/features/space/managers/workspace-resource.manager";
import { FileBreadcrumbs } from "./file-breadcrumbs";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
export function FileEditor({ id, compact = false, defaultPreview = false, tabId, preview: selectedPreview, onPreviewChange }: { id: string; compact?: boolean; defaultPreview?: boolean; tabId?: string; preview?: boolean; onPreviewChange?: (preview: boolean) => void }) {
  const { fileDetails, fileDrafts, editFile, saveFile, resolveFileConflict, openWorkspace, openFile } = useBiboSpaceStore();
  const [localPreview, setLocalPreview] = useState(defaultPreview);
  const preview = selectedPreview ?? localPreview;
  const setPreview = onPreviewChange ?? setLocalPreview;
  const [recovery, setRecovery] = useState<"reload" | "overwrite" | null>(null);
  const [failure, setFailure] = useState("");
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
  const html = /\.(html?|svg)$/i.test(detail.path);
  const framed = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"><style>body{margin:18px;font:14px/1.7 sans-serif;color:#29312a}</style>${draft.content}`;
  return (
    <div className={`bibo-file-editor${compact ? " is-compact" : ""}`} role={tabId ? "tabpanel" : undefined} id={tabId ? `${tabId}-panel` : undefined} aria-labelledby={tabId} onKeyDown={(event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (draft.dirty && !draft.saving) void saveFile(id);
      }
    }}>
      <div className="bibo-file-editor-head">
        <h2 className="visually-hidden">{detail.path.split("/").at(-1)}</h2>
        <FileBreadcrumbs path={detail.path} onOpenFile={(id) => void (compact ? openWorkspace(id) : openFile(id))} />
        <div className="file-editor-tools">
          <SegmentedControl
            label="文件模式"
            value={preview ? "preview" : "edit"}
            options={[
              { value: "edit", label: copy.fileEdit },
              { value: "preview", label: copy.filePreview },
            ]}
            onChange={(value) => setPreview(value === "preview")}
          />
          <span className="bibo-save-state visually-hidden" role="status" aria-live="polite" title={draft.dirty ? "有未保存的修改" : `已保存 · v${draft.version}`}>
            {draft.saving ? copy.fileSaving : draft.dirty ? copy.fileUnsaved : copy.fileSaved}
          </span>
          {(draft.dirty || draft.saving) && <Button tone="primary" disabled={draft.saving} onClick={() => void saveFile(id)}>{draft.saving ? copy.fileSaving : copy.fileSave}</Button>}
          <FileActions key={id} file={detail} label="文件操作" />
        </div>
      </div>
      {draft.error && <Notice tone="error">{draft.error}</Notice>}
      {draft.conflict && (
        <div className="file-conflict" role="alert">
          <span>文件已在别处更新。你的修改仍保留在这里。</span>
          <div>
            <Button tone="secondary" disabled={draft.saving} onClick={() => { setFailure(""); setRecovery("reload"); }}>读取最新版本</Button>
            <Button tone="text" disabled={draft.saving} onClick={() => { setFailure(""); setRecovery("overwrite"); }}>用当前草稿覆盖</Button>
          </div>
        </div>
      )}
      {preview ? (
        html ? (
          <iframe className="bibo-file-preview-frame" title={`预览 ${detail.path}`} sandbox="" srcDoc={framed} />
        ) : (
          <div className="bibo-file-preview-markdown">
            <Markdown text={draft.content} resolveResourceHref={workspaceResources.href} />
          </div>
        )
      ) : (
        <textarea
          aria-label={`编辑 ${detail.path}`}
          spellCheck={false}
          value={draft.content}
          onChange={(event) => editFile(id, event.target.value)}
          placeholder="从这里开始写…"
        />
      )}
      <ConfirmDialog open={recovery !== null} onOpenChange={(open) => { if (!open) setRecovery(null); }}
        title={recovery === "reload" ? "读取最新版本？" : "覆盖服务器内容？"}
        description={recovery === "reload" ? "当前未保存的修改将被放弃，替换为服务器最新版本。" : "将使用当前草稿覆盖服务器最新内容；如果期间再次发生修改，保存仍会被阻止。"}
        cancelLabel="取消" confirmLabel={recovery === "reload" ? "放弃修改并读取" : "确认覆盖"}
        busyLabel="正在处理…" busy={draft.saving} error={failure} onConfirm={() => void recover()} />
    </div>
  );
}
