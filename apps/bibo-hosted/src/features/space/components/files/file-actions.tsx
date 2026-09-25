import { useRef, useState } from "react";
import type { BiboFile } from "@nextclaw/bibo-client";
import {
  ActionMenu,
  ActionMenuItem,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
} from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";

export function FileActions({ file }: { file: BiboFile }) {
  const { moveFile, deleteFile, saving, fileDetails, fileDrafts } = useBiboSpaceStore();
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [path, setPath] = useState(file.path);
  const [failure, setFailure] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const startMove = () => {
    setPath(file.path);
    setFailure("");
    setMoving(true);
  };
  const dirty = Object.values(fileDetails).some((item) =>
    (item.id === file.id || item.path.startsWith(`${file.path}/`)) && fileDrafts[item.id]?.dirty);
  const extension = (value: string) => value.split("/").at(-1)?.match(/\.[^.]+$/)?.[0].toLowerCase() ?? "";
  const changesExtension = file.kind !== "folder" && extension(path.trim()) !== extension(file.path);
  const remove = async () => {
    if (saving) return;
    setFailure("");
    if (await deleteFile(file)) setDeleting(false);
    else setFailure(useBiboSpaceStore.getState().error);
  };
  const move = async () => {
    if (saving || !path.trim()) return;
    setFailure("");
    if (await moveFile(file, path.trim())) setMoving(false);
    else setFailure(useBiboSpaceStore.getState().error);
  };
  return (
    <>

        <ActionMenu
          label={file.kind === "folder" ? `管理目录 ${file.path}` : "文件操作"}
          triggerRef={trigger}
          transferringFocus={moving || deleting}
        >
          <ActionMenuItem onSelect={startMove}>移动 / 重命名</ActionMenuItem>
          <ActionMenuItem danger disabled={saving} onSelect={() => { setFailure(""); setDeleting(true); }}>
            删除
          </ActionMenuItem>
        </ActionMenu>
      <Dialog
        open={moving}
        onOpenChange={setMoving}
        title="移动 / 重命名"
        description={file.path}
        closeLabel="关闭文件操作"
        busy={saving}
        returnFocusRef={trigger}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void move();
          }}
        >
          <Field label="新路径">
            <Input
              required
              disabled={saving}
              value={path}
              onChange={(event) => setPath(event.target.value)}
              aria-label="文件新路径"
            />
          </Field>
          <p className="ui-overlay__hint">更改名称，或输入完整路径移动位置。</p>
          {changesExtension && <p role="status" className="ui-overlay__hint">更改扩展名会改变预览方式，但不会转换内容格式。</p>}
          {failure && (
            <p className="ui-overlay__error" role="alert">
              {failure}
            </p>
          )}
          <div className="ui-overlay__actions">
            <Button disabled={saving} onClick={() => setMoving(false)}>
              取消
            </Button>
            <Button
              tone="primary"
              type="submit"
              disabled={saving || !path.trim()}
            >
              {saving ? "正在保存…" : changesExtension ? "确认更改扩展名" : "确认移动"}
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={file.kind === "folder" ? "删除目录？" : "删除文件？"}
        description={`「${file.path}」${file.kind === "folder" ? "及其中的全部内容将被删除。" : "将被删除。"}${dirty ? "其中有未保存的修改，删除会一并放弃。" : "此操作目前不可撤销。"}`}
        cancelLabel="取消" confirmLabel="确认删除" busyLabel="正在删除…"
        busy={saving} error={failure} onConfirm={() => void remove()} returnFocusRef={trigger} />
    </>
  );
}
