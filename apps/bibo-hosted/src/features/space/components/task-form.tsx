import { useRef, useState, type FormEvent, type Ref } from "react";
import type { BiboProject, BiboTask } from "@nextclaw/bibo-client";
import { Button, Field, IconButton, Input, Select, Textarea, MarkdownEditor, Popover } from "@nextclaw/personal-agent-ui";
import { biboCopy } from "@/shared/configs/bibo-copy.config";
import { Ellipsis, X } from "lucide-react";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { localInput } from "@/features/space/utils/date-format.utils";
import type { TaskDraft } from "@/features/space/types/bibo-space.types";

export function TaskForm({ onDone, quick = false, onExpand }: { onDone: (savedId?: string) => void; quick?: boolean; onExpand?: () => void }) {
  const { projects, act, saving, taskDrafts, keepTaskDraft, clearTaskDraft, taskScope, taskProject } = useBiboSpaceStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saveError, setSaveError] = useState("");
  const draftKey = "new";
  const due = new Date();
  if (taskScope === "upcoming") due.setDate(due.getDate() + 1);
  due.setHours(23, 59, 0, 0);
  const draft: TaskDraft = taskDrafts[draftKey] ?? {
    title: "", description: "", status: "planned", priority: "medium", projectId: taskProject,
    subtasks: [], startAt: "",
    dueAt: taskScope === "today" || taskScope === "upcoming" ? localInput(due.toISOString()) : "",
    version: null,
  };
  const { title } = draft;
  const change = <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) =>
    keepTaskDraft(draftKey, { ...(useBiboSpaceStore.getState().taskDrafts[draftKey] ?? draft), [key]: value });
  const finish = () => {
    clearTaskDraft(draftKey);
    onDone();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const current = useBiboSpaceStore.getState().taskDrafts[draftKey] ?? draft;
    const { title, description, status, priority, projectId, startAt, dueAt, subtasks } = current;
    if (saving || !title.trim()) return;
    setSaveError("");
    const input = {
      title: title.trim(),
      description,
      status,
      priority,
      startAt: startAt ? new Date(startAt).toISOString() : null,
      projectId: projectId || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      subtasks,
    };
    const result = await act<BiboTask>("task.create", input, "tasks");
    if (result) {
      if (useBiboSpaceStore.getState().taskDrafts[draftKey] === current) clearTaskDraft(draftKey);
      onDone(result.id);
      if (quick) requestAnimationFrame(() => inputRef.current?.focus());
    } else setSaveError(useBiboSpaceStore.getState().actionError);
  };
  if (quick) return <QuickTaskInput title={title} saving={saving} error={saveError} inputRef={inputRef} onChange={(value) => change("title", value)} onSubmit={submit} onExpand={() => { setSaveError(""); onExpand?.(); }} />;
  return (
    <form className="bibo-editor-form task-editor" onSubmit={(event) => void submit(event)}
      onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}>
      <TaskEditorFields task={null} draft={draft} projects={projects} saving={saving} onChange={change} />
      {saveError && <p role="alert" className="ui-overlay__error">{saveError}</p>}
      <div className="ui-overlay__actions">
        <Button tone="primary" type="submit" disabled={saving || !title.trim()}>
          {saving ? "正在保存…" : "保存任务"}
        </Button>
        <Button tone="text" type="button" disabled={saving} onClick={finish}>
          取消
        </Button>
      </div>
    </form>
  );
}

export function TaskEditorFields({ task, draft, projects, saving, onChange }: {
  task: BiboTask | null;
  draft: TaskDraft;
  projects: BiboProject[];
  saving: boolean;
  onChange: <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) => void;
}) {
  const { title, description, subtasks } = draft;
  return <fieldset className="task-editor-fields" disabled={saving}>
    <div className="task-editor-main">
      <Textarea appearance="title" aria-label="任务名称" autoFocus={!task} required maxLength={160} rows={2} value={title}
        onChange={(event) => onChange("title", event.target.value)} placeholder="这件事要做到什么程度？" />
      <TaskEditorProperties draft={draft} projects={projects} saving={saving} onChange={onChange} />
      <div className="task-description-editor">
        <MarkdownEditor layout="embedded" value={description} onChange={(value) => onChange("description", value)}
          source={false} label={biboCopy.taskDetail.description} labels={biboCopy.markdownEditor}
          uploadImage={useBiboSpaceStore.getState().uploadImage} />
      </div>
      <SubtaskEditor compact={Boolean(task)} subtasks={subtasks} onChange={(items) => onChange("subtasks", items)} />
    </div>
  </fieldset>;
}

function TaskEditorProperties({ draft, projects, saving, onChange }: {
  draft: TaskDraft; projects: BiboProject[]; saving: boolean;
  onChange: <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { status, priority, projectId, startAt, dueAt } = draft;
  const project = projects.find((item) => item.id === projectId);
  return <div className="task-editor-metadata">
    <Popover open={expanded} onOpenChange={setExpanded} label={biboCopy.taskDetail.properties}
      trigger={<Button tone="quiet" disabled={saving} aria-label={biboCopy.taskDetail.properties}>
        {biboCopy.taskStatus[status]}<span aria-hidden="true">·</span>{biboCopy.taskDetail.priority[priority ?? "medium"]}
        {project && <><span aria-hidden="true">·</span>{project.name}</>}
        <span aria-hidden="true">⌄</span>
      </Button>}>
      <fieldset className="task-property-fields" disabled={saving}>
        <Field label="项目">
          <Select value={projectId} onChange={(event) => onChange("projectId", event.target.value)}>
            <option value="">未归入项目</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </Select>
        </Field>
        <div className="task-property-pair">
          <Field label="状态">
            <Select value={status} onChange={(event) => onChange("status", event.target.value as BiboTask["status"])}>
              <option value="planned">待开始</option><option value="active">进行中</option>
              <option value="done">已完成</option><option value="cancelled">已取消</option>
            </Select>
          </Field>
          <Field label="优先级">
            <Select value={priority} onChange={(event) => onChange("priority", event.target.value as BiboTask["priority"])}>
              <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
            </Select>
          </Field>
        </div>
        <Field label="开始时间">
          <Input type="datetime-local" value={startAt} onChange={(event) => onChange("startAt", event.target.value)} />
        </Field>
        <Field label="截止时间">
          <Input type="datetime-local" value={dueAt} onChange={(event) => onChange("dueAt", event.target.value)} />
        </Field>
      </fieldset>
    </Popover>
  </div>;
}

function QuickTaskInput({ title, saving, error, inputRef, onChange, onSubmit, onExpand }: {
  title: string; saving: boolean; error: string; inputRef: Ref<HTMLInputElement>; onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => Promise<void>; onExpand?: () => void;
}) {
  return <div className="task-quick-feedback"><form className="task-quick-add" aria-busy={saving} onSubmit={(event) => void onSubmit(event)}
    onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}>
    <Input ref={inputRef} aria-label="快速添加任务" placeholder="添加一个任务…" maxLength={160} value={title}
      onChange={(event) => onChange(event.target.value)} />
    <Button tone="primary" type="submit" disabled={saving || !title.trim()}>{saving ? "添加中…" : "＋ 新任务"}</Button>
    <IconButton type="button" label="打开完整新建任务" icon={<Ellipsis />} disabled={saving} onClick={onExpand} />
  </form>{error && <p role="alert" className="ui-overlay__error">{error}</p>}</div>;
}

function SubtaskEditor({
  subtasks,
  onChange,
  compact = false,
}: {
  subtasks: BiboTask["subtasks"];
  onChange: (items: BiboTask["subtasks"]) => void;
  compact?: boolean;
}) {
  const [subtaskInput, setSubtaskInput] = useState("");
  const [adding, setAdding] = useState(!compact);
  const add = () => {
    if (!subtaskInput.trim()) return;
    onChange([...subtasks, { id: crypto.randomUUID(), title: subtaskInput.trim(), done: false }]);
    setSubtaskInput("");
  };
  return (
    <div className="bibo-subtasks">
      <header className="task-subtask-heading"><h3>{biboCopy.taskDetail.subtasks}</h3><span>{biboCopy.taskDetail.progress(subtasks.filter((item) => item.done).length, subtasks.length)}</span></header>
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
      {!adding ? <Button tone="text" onClick={() => setAdding(true)}>+ {biboCopy.taskDetail.emptySubtasks}</Button> : <div className="bibo-inline-input">
        <Input
          autoFocus={compact}
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
      </div>}
    </div>
  );
}
