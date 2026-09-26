import { useState, type FormEvent } from "react";
import type { BiboTask } from "@nextclaw/bibo-client";
import { Button, ConfirmDialog, Field, IconButton, Input, Select, Textarea } from "@nextclaw/personal-agent-ui";
import { X } from "lucide-react";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { localInput } from "@/features/space/utils/date-format.utils";

export function TaskForm({ task, onDone }: { task: BiboTask | null; onDone: (savedId?: string) => void }) {
  const { projects, act, saving, taskDrafts, keepTaskDraft, clearTaskDraft } = useBiboSpaceStore();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [expanded, setExpanded] = useState(Boolean(task));
  const remove = async () => {
    if (!task || saving) return;
    setDeleteError("");
    const result = await act("task.delete", { id: task.id, version: task.version }, "tasks");
    if (result) { setDeleting(false); finish(); }
    else setDeleteError(useBiboSpaceStore.getState().error);
  };
  const draftKey = task?.id ?? "new";
  const draft = taskDrafts[draftKey] ?? {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "planned",
    priority: task?.priority ?? "medium",
    projectId: task?.projectId ?? "",
    subtasks: task?.subtasks ?? [],
    startAt: task?.startAt ? localInput(task.startAt) : "",
    dueAt: task?.dueAt ? localInput(task.dueAt) : "",
    version: task?.version ?? null,
  };
  const { title, description, status, priority, projectId, startAt, dueAt, subtasks, version } = draft;
  const change = <Key extends keyof typeof draft>(key: Key, value: (typeof draft)[Key]) =>
    keepTaskDraft(draftKey, { ...draft, [key]: value });
  const finish = () => {
    clearTaskDraft(draftKey);
    onDone();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = {
      title,
      description,
      status,
      priority,
      startAt: startAt ? new Date(startAt).toISOString() : null,
      projectId: projectId || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      subtasks,
    };
    const result = task
      ? await act<BiboTask>("task.update", { ...input, id: task.id, version }, "tasks")
      : await act<BiboTask>("task.create", input, "tasks");
    if (result) {
      clearTaskDraft(draftKey);
      onDone(result.id);
    }
  };
  return (
    <form className="bibo-editor-form task-editor" onSubmit={(event) => void submit(event)}>
      <div className="task-editor-fields">
        <Field label="任务名称">
          <Input
            autoFocus={!task}
            required
            maxLength={160}
            value={title}
            onChange={(event) => change("title", event.target.value)}
            placeholder="这件事要做到什么程度？"
          />
        </Field>
        <Button tone="text" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "收起详情" : "添加详情"}
        </Button>
        {expanded && <>
        <Field label="说明">
          <Textarea
            rows={4}
            value={description}
            onChange={(event) => change("description", event.target.value)}
            placeholder="补充背景、下一步或完成标准"
          />
        </Field>
        <SubtaskEditor subtasks={subtasks} onChange={(items) => change("subtasks", items)} />
        <Field label="项目">
          <Select value={projectId} onChange={(event) => change("projectId", event.target.value)}>
            <option value="">未归入项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="task-property-pair">
          <Field label="状态">
            <Select value={status} onChange={(event) => change("status", event.target.value as BiboTask["status"])}>
              <option value="planned">待开始</option>
              <option value="active">进行中</option>
              <option value="done">已完成</option>
              <option value="cancelled">已取消</option>
            </Select>
          </Field>
          <Field label="优先级">
            <Select
              value={priority}
              onChange={(event) => change("priority", event.target.value as BiboTask["priority"])}
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </Select>
          </Field>
        </div>
        <Field label="开始时间">
          <Input type="datetime-local" value={startAt} onChange={(event) => change("startAt", event.target.value)} />
        </Field>
        <Field label="截止时间">
          <Input type="datetime-local" value={dueAt} onChange={(event) => change("dueAt", event.target.value)} />
        </Field>
        </>}
      </div>
      <div className="bibo-action-row">
        <Button tone="primary" type="submit" disabled={saving}>
          {saving ? "正在保存…" : "保存任务"}
        </Button>
        <Button tone="text" type="button" onClick={finish}>
          取消
        </Button>
        {task && (
          <Button
            tone="danger"
            type="button"
            disabled={saving}
            onClick={() => { setDeleteError(""); setDeleting(true); }}
          >
            删除任务
          </Button>
        )}
      </div>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="删除任务？"
        description={`「${task?.title ?? ""}」及其子任务将被删除，此操作目前不可撤销。`}
        cancelLabel="取消" confirmLabel="删除任务" busyLabel="正在删除…"
        busy={saving} error={deleteError} onConfirm={() => void remove()} />
    </form>
  );
}

function SubtaskEditor({
  subtasks,
  onChange,
}: {
  subtasks: BiboTask["subtasks"];
  onChange: (items: BiboTask["subtasks"]) => void;
}) {
  const [subtaskInput, setSubtaskInput] = useState("");
  const add = () => {
    if (!subtaskInput.trim()) return;
    onChange([...subtasks, { id: crypto.randomUUID(), title: subtaskInput.trim(), done: false }]);
    setSubtaskInput("");
  };
  return (
    <div className="bibo-subtasks">
      <p>子任务</p>
      {subtasks.map((item) => (
        <div key={item.id} className="bibo-check-row">
          <label>
            <input
              type="checkbox"
              checked={item.done}
              onChange={(event) =>
                onChange(subtasks.map((part) => (part.id === item.id ? { ...part, done: event.target.checked } : part)))
              }
            />
            <span>{item.title}</span>
          </label>
          <IconButton
            type="button"
            label={`删除子任务 ${item.title}`}
            icon={<X />}
            onClick={() => onChange(subtasks.filter((part) => part.id !== item.id))}
          />
        </div>
      ))}
      <div className="bibo-inline-input">
        <Input
          value={subtaskInput}
          onChange={(event) => setSubtaskInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add();
            }
          }}
          placeholder="添加一个步骤"
        />
        <Button tone="secondary" type="button" onClick={add}>
          添加
        </Button>
      </div>
    </div>
  );
}
