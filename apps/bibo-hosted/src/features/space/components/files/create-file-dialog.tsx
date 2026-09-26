import { useState, type FormEvent } from "react";
import type { BiboFile } from "@nextclaw/bibo-client";
import { Button, Dialog, Field, Input, Select } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";

export function CreateFileDialog({ parent, initialKind, notesOnly, onClose }: {
  parent: string;
  initialKind: BiboFile["kind"];
  notesOnly: boolean;
  onClose: () => void;
}) {
  const { createFile, saving } = useBiboSpaceStore();
  const [name, setName] = useState("");
  const [kind, setKind] = useState(initialKind);
  const [failure, setFailure] = useState("");
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setFailure("");
    const path = `${parent ? `${parent}/` : ""}${name.trim()}${kind === "note" && !/\.md$/i.test(name.trim()) ? ".md" : ""}`;
    if (await createFile(path, kind)) onClose();
    else setFailure(useBiboSpaceStore.getState().error);
  };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title={notesOnly ? "新笔记" : "新建文件"}
    closeLabel="关闭新建" busy={saving} description={`保存在 ${parent || "根目录"}`}>
    <form onSubmit={(event) => void create(event)}>
      <Field label={kind === "folder" ? "文件夹名称" : "文件名称"}>
        <Input disabled={saving} required value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "folder" ? "文件夹名称" : "文件名称"} />
      </Field>
      {!notesOnly && <Field label="类型"><Select disabled={saving} aria-label="文件类型" value={kind} onChange={(event) => setKind(event.target.value as BiboFile["kind"])}>
        <option value="document">文档</option><option value="note">笔记</option><option value="folder">文件夹</option><option value="artifact">产物</option>
      </Select></Field>}
      {failure && <p className="ui-overlay__error" role="alert">{failure}</p>}
      <div className="ui-overlay__actions">
        <Button disabled={saving} onClick={onClose}>取消</Button>
        <Button tone="primary" type="submit" disabled={saving || !name.trim()}>{saving ? "正在创建…" : "创建"}</Button>
      </div>
    </form>
  </Dialog>;
}
