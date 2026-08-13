import { CalendarDays, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@shared/components/button";
import { Dialog } from "@shared/components/dialog";
import type { TodoDraft, TodoPriority } from "@shared/types/personal-organizer.types";
import { toLocalDateTimeValue } from "@shared/utils/date.utils";
import { todosPresenter } from "@/features/todos/presenters/todos.presenter";
import { useTodoStore } from "@/features/todos/stores/todo.store";

const emptyDraft: TodoDraft = { title: "", notes: "", dueDate: "", priority: "normal" };

export function TodoEditor() {
  const { editorOpen, editorItemId, editorPending, closeEditor, items } = useTodoStore();
  const item = items.find((entry) => entry.id === editorItemId);
  const [draft, setDraft] = useState<TodoDraft>(() => item ? {
    title: item.title,
    notes: item.notes,
    dueDate: item.dueDate ? toLocalDateTimeValue(item.dueDate) : "",
    priority: item.priority,
  } : emptyDraft);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    await todosPresenter.manager.save({
      ...draft,
      title,
      notes: draft.notes.trim(),
      dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : "",
    }, item?.id);
  };

  return (
    <Dialog open={editorOpen} title={item ? "编辑待办" : "添加待办"} initialFocusSelector="#todo-title" onClose={() => !editorPending && closeEditor()}>
      <form className="p-5" onSubmit={submit}>
        <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="todo-title">要做什么</label>
        <input id="todo-title" required maxLength={180} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-transparent px-3.5 py-3 text-[15px] outline-none focus:border-[var(--line-strong)]" placeholder="清楚写下下一步" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="todo-due">截止时间</label>
            <div className="relative mt-2"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" size={16} /><input id="todo-due" type="datetime-local" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} className="w-full rounded-xl border border-[var(--line)] bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--line-strong)]" /></div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="todo-priority">优先级</label>
            <select id="todo-priority" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TodoPriority }))} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--line-strong)]">
              <option value="normal">普通</option><option value="high">高</option><option value="low">低</option>
            </select>
          </div>
        </div>
        <label className="mt-4 block text-xs font-semibold text-[var(--muted)]" htmlFor="todo-notes">备注</label>
        <textarea id="todo-notes" rows={4} maxLength={2000} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-transparent px-3.5 py-3 text-sm leading-6 outline-none focus:border-[var(--line-strong)]" placeholder="补充完成它需要的上下文" />
        <footer className="mt-5 flex min-h-10 items-center justify-between gap-3">
          {item ? deleteConfirm ? (
            <div className="flex items-center gap-2"><span className="text-xs text-[var(--danger)]">确认删除？</span><Button tone="danger" disabled={editorPending} onClick={() => void todosPresenter.manager.delete(item.id)}>删除</Button><Button tone="ghost" disabled={editorPending} onClick={() => setDeleteConfirm(false)}>取消</Button></div>
          ) : <Button tone="ghost" icon={<Trash2 size={16} />} disabled={editorPending} onClick={() => setDeleteConfirm(true)}>删除</Button> : <span />}
          <div className="flex gap-2"><Button tone="ghost" disabled={editorPending} onClick={closeEditor}>取消</Button><Button type="submit" tone="primary" disabled={editorPending || !draft.title.trim()}>{editorPending ? "保存中…" : "保存"}</Button></div>
        </footer>
      </form>
    </Dialog>
  );
}
