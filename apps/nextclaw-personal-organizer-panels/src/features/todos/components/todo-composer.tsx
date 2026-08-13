import { ArrowUp, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { todosPresenter } from "@/features/todos/presenters/todos.presenter";
import { useTodoStore } from "@/features/todos/stores/todo.store";

export function TodoComposer() {
  const [title, setTitle] = useState("");
  const quickPending = useTodoStore((state) => state.quickPending);
  const openEditor = useTodoStore((state) => state.openEditor);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    if (await todosPresenter.manager.createQuick(value)) setTitle("");
  };

  return (
    <div className="panel-surface p-2">
      <form className="flex items-center gap-2" onSubmit={submit}>
        <span className="ml-2 grid h-8 w-8 shrink-0 place-items-center text-[var(--faint)]"><Plus size={18} /></span>
        <label className="sr-only" htmlFor="quick-todo">添加待办</label>
        <input
          id="quick-todo"
          value={title}
          maxLength={180}
          autoComplete="off"
          placeholder="添加一件要做的事"
          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-[var(--faint)]"
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          type="submit"
          disabled={!title.trim() || quickPending}
          aria-label="添加待办"
          title="添加待办"
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ArrowUp size={17} strokeWidth={2.3} />
        </button>
      </form>
      <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] px-3 pt-2 pb-0.5">
        <span className="text-xs text-[var(--faint)]">按回车快速添加</span>
        <button type="button" className="focus-ring rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]" onClick={() => openEditor()}>
          添加日期和备注
        </button>
      </div>
    </div>
  );
}
