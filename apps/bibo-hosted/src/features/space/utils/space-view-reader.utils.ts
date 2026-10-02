import type { BiboClient, BiboEvent, BiboFile, BiboInboxItem, BiboOverview, BiboProject, BiboTask } from "@nextclaw/bibo-client";
import type { BiboView } from "@/features/space/stores/bibo-space.store";
import { biboCopy } from "@/shared/configs/bibo-copy.config";
import type { FileDirectoryManager } from "@/features/space/managers/file-directory.manager";

type Page<T> = { items: T[]; nextCursor: string | null };
type Lists = {
  overview?: BiboOverview; projects?: BiboProject[]; tasks?: BiboTask[];
  inbox?: BiboInboxItem[]; notes?: BiboFile[];
  cursors: Record<string, string | null>;
};

export function taskListFilter({ taskQuery, taskProject, taskScope, taskAnchor }: {
  taskQuery: string; taskProject: string; taskScope: "all" | "today" | "upcoming" | "done"; taskAnchor: Date;
}): Record<string, unknown> {
  const tomorrow = new Date(taskAnchor); tomorrow.setHours(24, 0, 0, 0);
  return { query: taskQuery, ...(taskProject ? { projectId: taskProject } : {}), ...(taskScope === "done" ? { status: "done" } : taskScope === "all" ? {} : { open: true, [taskScope === "today" ? "dueBefore" : "dueFrom"]: tomorrow.toISOString() }) };
}

export function projectSavedTask(items: BiboTask[], result: BiboTask | { deleted: string }, filter: Record<string, unknown>): BiboTask[] {
  const id = "deleted" in result ? result.deleted : result.id;
  const remaining = items.filter((task) => task.id !== id);
  if (!("deleted" in result)) {
    const matches = (!filter.projectId || result.projectId === filter.projectId)
      && (!filter.status || result.status === filter.status)
      && (!filter.open || !["done", "cancelled"].includes(result.status))
      && (!filter.dueBefore || !!result.dueAt && result.dueAt < String(filter.dueBefore))
      && (!filter.dueFrom || !!result.dueAt && result.dueAt >= String(filter.dueFrom))
      && (!filter.query || `${result.title} ${result.description}`.toLocaleLowerCase().includes(String(filter.query).toLocaleLowerCase()));
    if (matches) remaining.push(result);
  }
  return remaining.sort((a, b) => filter.dueBefore || filter.dueFrom
    ? (a.dueAt ?? "").localeCompare(b.dueAt ?? "") || a.id.localeCompare(b.id)
    : b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

export function savedTaskView(state: Parameters<typeof taskListFilter>[0] & {
  tasks: BiboTask[]; selectedTaskId: string | null; taskSelection: BiboTask | null;
  taskUndo: { id: string } | null;
  readStatus: Partial<Record<BiboView, "loading" | "ready" | "error">>;
}, saved: BiboTask | { deleted: string }) {
  return {
    tasks: projectSavedTask(state.tasks, saved, taskListFilter(state)),
    feedback: { message: "deleted" in saved ? biboCopy.taskDeleted : biboCopy.taskSaved(saved.title), task: "deleted" in saved ? null : saved },
    ...(("deleted" in saved ? saved.deleted : saved.id) === state.taskUndo?.id ? { taskUndo: null } : {}),
    taskSelection: "deleted" in saved
      ? state.taskSelection?.id === saved.deleted ? null : state.taskSelection
      : state.selectedTaskId === saved.id ? saved : state.taskSelection,
    saving: false,
    readStatus: { ...state.readStatus, tasks: "ready" as const },
  };
}

export function readNextSpacePage(client: BiboClient, state: Parameters<typeof taskListFilter>[0] & {
  noteQuery: string; inboxScope: "pending" | "unread" | "all";
}, domain: "tasks" | "events" | "inbox" | "notes", cursor: string): Promise<Page<unknown>> {
  const action = { tasks: "task.list", events: "event.list", inbox: "inbox.list", notes: "file.list" }[domain];
  return client.space(action, { limit: 100, cursor,
    ...(domain === "tasks" ? taskListFilter(state) : {}),
    ...(domain === "notes" ? { kind: "note", query: state.noteQuery, sort: "recent" } : {}),
    ...(domain === "inbox" ? { unresolved: state.inboxScope === "pending", unread: state.inboxScope === "unread" } : {}),
  });
}

export async function readCalendarEvents(client: BiboClient, range: { from: string; to: string }): Promise<BiboEvent[]> {
  const events: BiboEvent[] = [];
  let cursor: string | null = null;
  do {
    const page: Page<BiboEvent> = await client.space("event.list", { ...range, limit: 100, ...(cursor ? { cursor } : {}) });
    events.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return events;
}

export async function readSpaceLists(client: BiboClient, input: {
  view: BiboView; taskFilter: Record<string, unknown>; noteQuery: string; inboxScope: "pending" | "unread" | "all"; fileDirectory: FileDirectoryManager;
}): Promise<Lists> {
  if (input.view === "overview") return { overview: await client.space<BiboOverview>("overview.get"), cursors: {} };
  if (input.view === "tasks") {
    const [projects, tasks] = await Promise.all([
      client.space<Page<BiboProject>>("project.list", { limit: 100 }),
      client.space<Page<BiboTask>>("task.list", { limit: 100, ...input.taskFilter }),
    ]);
    return { projects: projects.items, tasks: tasks.items, cursors: { tasks: tasks.nextCursor } };
  }
  if (input.view === "inbox") {
    const inbox = await client.space<Page<BiboInboxItem>>("inbox.list", { limit: 100, unresolved: input.inboxScope === "pending", unread: input.inboxScope === "unread" });
    return { inbox: inbox.items, cursors: { inbox: inbox.nextCursor } };
  }
  if (input.view === "files") await input.fileDirectory.refresh();
  if (input.view === "notes") {
    const notes = await client.space<Page<BiboFile>>("file.list", { kind: "note", query: input.noteQuery, sort: "recent", limit: 100 });
    return { notes: notes.items, cursors: { notes: notes.nextCursor } };
  }
  return { cursors: {} };
}
