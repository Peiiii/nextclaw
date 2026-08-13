import { CheckCircle2, Plus } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@shared/components/button";
import { ToastRegion } from "@shared/components/toast-region";
import { todosPresenter } from "@/features/todos/presenters/todos.presenter";
import { useTodoStore } from "@/features/todos/stores/todo.store";
import { TodoComposer } from "./todo-composer";
import { TodoEditor } from "./todo-editor";
import { TodoList } from "./todo-list";

export function TodosApp() {
  const items = useTodoStore((state) => state.items);
  const status = useTodoStore((state) => state.status);
  const notice = useTodoStore((state) => state.notice);
  const openEditor = useTodoStore((state) => state.openEditor);
  const editorOpen = useTodoStore((state) => state.editorOpen);
  const editorItemId = useTodoStore((state) => state.editorItemId);
  const openCount = items.filter((item) => !item.completed).length;

  useEffect(() => { void todosPresenter.manager.load(); }, []);

  return (
    <main className="panel-shell max-w-[900px]">
      <header className="mb-6 flex items-start justify-between gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--text)] text-[var(--canvas)]"><CheckCircle2 size={21} /></span>
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold tracking-[-0.035em]">待办</h1>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{status === "ready" ? (openCount ? `${openCount} 件事正在等你` : "眼前没有未完成的事") : "把下一步放在眼前"}</p>
          </div>
        </div>
        <Button tone="secondary" icon={<Plus size={16} />} className="hidden sm:inline-flex" onClick={() => openEditor()}>添加</Button>
      </header>
      <TodoComposer />
      <div className="mt-7"><TodoList /></div>
      <TodoEditor key={`${editorOpen ? "open" : "closed"}:${editorItemId ?? "new"}`} />
      <ToastRegion notice={notice} onAction={() => void todosPresenter.manager.undoLastCompletion()} />
    </main>
  );
}
