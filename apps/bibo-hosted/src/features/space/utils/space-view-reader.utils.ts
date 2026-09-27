import type { BiboClient, BiboFile, BiboInboxItem, BiboOverview, BiboProject, BiboTask } from "@nextclaw/bibo-client";
import type { BiboView } from "@/features/space/stores/bibo-space.store";

type Page<T> = { items: T[]; nextCursor: string | null };
type Lists = {
  overview?: BiboOverview; projects?: BiboProject[]; tasks?: BiboTask[];
  inbox?: BiboInboxItem[]; files?: BiboFile[]; notes?: BiboFile[];
  cursors: Record<string, string | null>;
};

export function taskListFilter({ taskQuery, taskProject, taskScope, taskAnchor }: {
  taskQuery: string; taskProject: string; taskScope: "all" | "today" | "upcoming" | "done"; taskAnchor: Date;
}): Record<string, unknown> {
  const tomorrow = new Date(taskAnchor); tomorrow.setHours(24, 0, 0, 0);
  return { query: taskQuery, ...(taskProject ? { projectId: taskProject } : {}), ...(taskScope === "done" ? { status: "done" } : taskScope === "all" ? {} : { open: true, [taskScope === "today" ? "dueBefore" : "dueFrom"]: tomorrow.toISOString() }) };
}

export async function readSpaceLists(client: BiboClient, input: {
  view: BiboView; taskFilter: Record<string, unknown>; noteQuery: string; inboxScope: "pending" | "unread" | "all";
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
  if (input.view === "files" || input.view === "notes") {
    const [files, notes] = await Promise.all([
      client.space<Page<BiboFile>>("file.list", { limit: 100 }),
      input.view === "notes" ? client.space<Page<BiboFile>>("file.list", { kind: "note", query: input.noteQuery, sort: "recent", limit: 100 }) : Promise.resolve(null),
    ]);
    return { files: files.items, ...(notes ? { notes: notes.items } : {}), cursors: { files: files.nextCursor, ...(notes ? { notes: notes.nextCursor } : {}) } };
  }
  return { cursors: {} };
}
