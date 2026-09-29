import { useState } from "react";
import type { BiboTask } from "@nextclaw/bibo-client";
import { ActionMenu, ActionMenuItem, Button, ConfirmDialog, Markdown, Sheet } from "@nextclaw/personal-agent-ui";
import { CalendarDays, Circle, Flag, Folder, Pencil } from "lucide-react";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { localInput } from "@/features/space/utils/date-format.utils";
import { workspaceResources } from "@/features/space/managers/workspace-resource.manager";
import type { TaskDraft } from "@/features/space/types/bibo-space.types";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
import { TaskEditorFields } from "./task-form";

const labels = copy.taskDetail;

export function TaskDetail({ task, onClose }: { task: BiboTask; onClose: () => void }) {
  const { projects, taskDrafts, keepTaskDraft, clearTaskDraft, act, saving } = useBiboSpaceStore();
  const [editing, setEditing] = useState(Boolean(taskDrafts[task.id]));
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const draft: TaskDraft = taskDrafts[task.id] ?? {
    title: task.title, description: task.description, status: task.status, priority: task.priority,
    subtasks: task.subtasks, projectId: task.projectId ?? "", version: task.version,
    startAt: task.startAt ? localInput(task.startAt) : "", dueAt: task.dueAt ? localInput(task.dueAt) : "",
  };
  const change = <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) => {
    const latest = useBiboSpaceStore.getState().taskDrafts[task.id] ?? draft;
    keepTaskDraft(task.id, { ...latest, [key]: value });
  };
  const save = async () => {
    const current = useBiboSpaceStore.getState().taskDrafts[task.id] ?? draft;
    if (saving || !current.title.trim()) return;
    setError("");
    const result = await act<BiboTask>("task.update", {
      ...current, id: task.id, title: current.title.trim(), projectId: current.projectId || null,
      startAt: current.startAt ? new Date(current.startAt).toISOString() : null,
      dueAt: current.dueAt ? new Date(current.dueAt).toISOString() : null,
    }, "tasks");
    if (!result) { setError(useBiboSpaceStore.getState().actionError); return; }
    const pending = useBiboSpaceStore.getState().taskDrafts[task.id];
    if (!pending || pending === current) { clearTaskDraft(task.id); setEditing(false); }
    else keepTaskDraft(task.id, { ...pending, version: result.version });
  };
  const remove = async () => {
    setError("");
    const result = await act("task.delete", { id: task.id, version: task.version }, "tasks");
    if (result) { clearTaskDraft(task.id); onClose(); }
    else setError(useBiboSpaceStore.getState().actionError);
  };
  const toggle = async (id: string) => {
    setError("");
    const result = await act("task.update", { id: task.id, version: task.version,
      subtasks: task.subtasks.map((item) => item.id === id ? { ...item, done: !item.done } : item),
    }, "tasks");
    if (!result) setError(useBiboSpaceStore.getState().actionError);
  };
  const actions = <>{editing ? <>
    <Button tone="text" disabled={saving} onClick={() => { clearTaskDraft(task.id); setEditing(false); setError(""); }}>{labels.cancel}</Button>
    <Button tone="primary" aria-label={labels.save} disabled={saving || !draft.title.trim()} onClick={() => void save()}>{saving ? labels.saving : labels.saveShort}</Button>
  </> : <Button tone="text" aria-label={labels.edit} disabled={saving} onClick={() => setEditing(true)}><Pencil size={15} />{labels.editShort}</Button>}
    <ActionMenu label={labels.more} transferringFocus={deleting}>
      <ActionMenuItem danger disabled={saving} onSelect={() => { setError(""); setDeleting(true); }}>{labels.remove}</ActionMenuItem>
    </ActionMenu>
  </>;
  return <Sheet open title={labels.title} closeLabel={labels.close} side="right" size="wide" initialFocus="content"
    busy={saving} actions={actions} onOpenChange={(open) => { if (!open) onClose(); }}>
    <div className="task-detail" onKeyDown={(event) => {
      if (editing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault(); void save();
      }
    }}>
      {error && !deleting && <p role="alert" className="ui-overlay__error">{error}</p>}
      {editing ? <>
        {taskDrafts[task.id] && <p className="task-detail-draft">{labels.draft}</p>}
        <TaskEditorFields task={task} draft={draft} projects={projects} saving={saving} onChange={change} />
      </> : <TaskReading task={task} project={projects.find((project) => project.id === task.projectId)?.name}
        saving={saving} onEdit={() => setEditing(true)} onToggle={(id) => void toggle(id)} />}
    </div>
    <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={labels.deleteTitle} description={labels.deleteDescription}
      cancelLabel={labels.cancel} confirmLabel={labels.remove} busyLabel={labels.deleting} busy={saving} error={error}
      onConfirm={() => void remove()} />
  </Sheet>;
}

function TaskReading({ task, project, saving, onEdit, onToggle }: {
  task: BiboTask; project?: string; saving: boolean; onEdit: () => void; onToggle: (id: string) => void;
}) {
  const done = task.subtasks.filter((item) => item.done).length;
  return <article className="task-detail-document">
    <h1>{task.title}</h1>
    <div className="task-detail-metadata">
      <span><Circle size={14} />{copy.taskStatus[task.status]}</span>
      <span><Flag size={14} />{labels.priority[task.priority ?? "medium"]}</span>
      {project && <span><Folder size={14} />{project}</span>}
      {(["startAt", "dueAt"] as const).map((key) => task[key] && <span key={key}><CalendarDays size={14} />
        {key === "startAt" ? labels.start : labels.due} {new Date(task[key]!).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>)}
    </div>
    <section className="task-detail-description" aria-label={labels.description}>
      {task.description ? <Markdown text={task.description} resolveResourceHref={workspaceResources.href} /> :
        <Button tone="text" onClick={onEdit}>{labels.emptyDescription}</Button>}
    </section>
    <section className="task-detail-subtasks" aria-label={labels.subtasks}>
      <header><h2>{labels.subtasks}</h2><span>{labels.progress(done, task.subtasks.length)}</span></header>
      {task.subtasks.length > 0 && <progress value={done} max={task.subtasks.length} aria-label={labels.subtasks} />}
      {task.subtasks.map((item) => <label key={item.id} className="task-detail-step">
        <input type="checkbox" checked={item.done} disabled={saving} onChange={() => onToggle(item.id)} />
        <span className={item.done ? "is-done" : undefined}>{item.title}</span>
      </label>)}
      <Button tone="text" onClick={onEdit}>+ {labels.emptySubtasks}</Button>
    </section>
  </article>;
}
