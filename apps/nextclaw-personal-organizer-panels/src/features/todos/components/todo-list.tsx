import { CalendarClock, Check, Circle, FileText, MoreHorizontal } from "lucide-react";
import type { TodoItem } from "@shared/types/personal-organizer.types";
import { formatTodoDue, getTodoGroup, type TodoGroupKey } from "@shared/utils/date.utils";
import { IconButton } from "@shared/components/icon-button";
import { StatusView } from "@shared/components/status-view";
import { todosPresenter } from "@/features/todos/presenters/todos.presenter";
import { useTodoStore } from "@/features/todos/stores/todo.store";

const groupLabels: Record<TodoGroupKey, string> = {
  overdue: "已逾期",
  today: "今天",
  upcoming: "接下来",
  anytime: "无日期",
  completed: "已完成",
};

const openGroupOrder: TodoGroupKey[] = ["overdue", "today", "upcoming", "anytime"];

function TodoRow({ item }: { item: TodoItem }) {
  const pending = useTodoStore((state) => state.pendingIds.includes(item.id));
  const openEditor = useTodoStore((state) => state.openEditor);
  const overdue = getTodoGroup(item) === "overdue";
  return (
    <div className={`group flex min-w-0 items-start gap-3 px-4 py-3.5 transition hover:bg-[var(--surface-muted)]/70 ${pending ? "opacity-55" : ""}`}>
      <button
        type="button"
        disabled={pending}
        aria-label={item.completed ? `恢复“${item.title}”` : `完成“${item.title}”`}
        className={`focus-ring mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${item.completed ? "border-[var(--success)] bg-[var(--success)] text-white" : "border-[var(--line-strong)] text-transparent hover:border-[var(--success)] hover:text-[var(--success)]"}`}
        onClick={() => void todosPresenter.manager.toggleCompleted(item, !item.completed)}
      >
        {item.completed ? <Check size={13} strokeWidth={3} /> : <Circle size={10} fill="currentColor" />}
      </button>
      <button type="button" className="focus-ring min-w-0 flex-1 rounded-md text-left" onClick={() => openEditor(item.id)}>
        <span className={`block break-words text-[14px] font-medium leading-5 ${item.completed ? "text-[var(--muted)] line-through" : "text-[var(--text)]"}`}>{item.title}</span>
        {item.dueDate || item.notes || item.priority !== "normal" ? (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
            {item.dueDate ? <span className={`inline-flex items-center gap-1 ${overdue ? "font-medium text-[var(--danger)]" : ""}`}><CalendarClock size={12} />{formatTodoDue(item.dueDate)}</span> : null}
            {item.priority === "high" ? <span className="rounded-md bg-[var(--warning-soft)] px-1.5 py-0.5 font-medium text-[var(--warning)]">高优先级</span> : null}
            {item.notes ? <span className="inline-flex items-center gap-1"><FileText size={12} />有备注</span> : null}
          </span>
        ) : null}
      </button>
      <IconButton label={`编辑“${item.title}”`} className="-mr-1 -mt-1 opacity-55 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => openEditor(item.id)}>
        <MoreHorizontal size={17} />
      </IconButton>
    </div>
  );
}

export function TodoList() {
  const { items, status, error, filter, setFilter, openEditor } = useTodoStore();
  const openItems = items.filter((item) => !item.completed);
  const completedItems = items.filter((item) => item.completed);
  const visible = filter === "open" ? openItems : completedItems;

  if (status === "loading" || status === "idle") return <div className="panel-surface"><StatusView kind="loading" title="正在整理待办" /></div>;
  if (status === "error") return <div className="panel-surface"><StatusView kind="error" title="暂时无法读取待办" description={error} actionLabel="重新加载" onAction={() => void todosPresenter.manager.load()} /></div>;

  return (
    <section aria-label="待办列表">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex rounded-xl bg-[var(--surface-muted)] p-1" role="tablist" aria-label="筛选待办">
          <button type="button" role="tab" aria-selected={filter === "open"} className={`focus-ring min-w-[84px] rounded-lg px-3 py-1.5 text-sm transition ${filter === "open" ? "bg-[var(--surface)] font-medium text-[var(--text)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"}`} onClick={() => setFilter("open")}>进行中 <span className="ml-1 text-xs text-[var(--faint)]">{openItems.length}</span></button>
          <button type="button" role="tab" aria-selected={filter === "completed"} className={`focus-ring min-w-[84px] rounded-lg px-3 py-1.5 text-sm transition ${filter === "completed" ? "bg-[var(--surface)] font-medium text-[var(--text)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"}`} onClick={() => setFilter("completed")}>已完成 <span className="ml-1 text-xs text-[var(--faint)]">{completedItems.length}</span></button>
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="panel-surface">
          <StatusView
            kind="empty"
            title={filter === "open" ? "今天没有待处理的事" : "还没有完成记录"}
            description={filter === "open" ? "记下一件真正需要推进的事，剩下的交给列表。" : "完成的待办会留在这里，随时可以恢复。"}
            actionLabel={filter === "open" ? "添加待办" : undefined}
            onAction={filter === "open" ? () => openEditor() : undefined}
          />
        </div>
      ) : filter === "completed" ? (
        <div className="panel-surface divide-y divide-[var(--line)] overflow-hidden">
          {completedItems.map((item) => <TodoRow key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="space-y-5">
          {openGroupOrder.map((group) => {
            const groupItems = openItems.filter((item) => getTodoGroup(item) === group);
            if (!groupItems.length) return null;
            return (
              <section key={group} aria-labelledby={`todo-group-${group}`}>
                <h2 id={`todo-group-${group}`} className={`mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] ${group === "overdue" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>{groupLabels[group]} <span className="font-normal text-[var(--faint)]">{groupItems.length}</span></h2>
                <div className="panel-surface divide-y divide-[var(--line)] overflow-hidden">
                  {groupItems.map((item) => <TodoRow key={item.id} item={item} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
