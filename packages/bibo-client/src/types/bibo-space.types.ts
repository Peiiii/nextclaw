export type BiboSpaceDomain = "projects" | "tasks" | "events" | "inbox" | "files" | "notes";

export type BiboProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type BiboSubtask = { id: string; title: string; done: boolean };

export type BiboTask = {
  id: string;
  projectId: string | null;
  title: string;
  description: string;
  status: "planned" | "active" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
  startAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  subtasks: BiboSubtask[];
  source: { kind: "user" | "agent"; sessionId?: string };
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type BiboEvent = {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  source: { kind: "user" | "agent"; sessionId?: string };
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type BiboInboxItem = {
  id: string;
  kind: "agent" | "reminder" | "decision";
  title: string;
  body: string;
  source: { kind: "bibo" | "session" | "task" | "event" | "file"; id?: string };
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  resolvedAt: string | null;
  version: number;
};

export type BiboFile = {
  id: string;
  path: string;
  kind: "folder" | "note" | "document" | "artifact";
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type BiboFileDetail = BiboFile & { content: string | null };

export type BiboOverview = {
  inbox: BiboInboxItem[];
  events: BiboEvent[];
  tasks: BiboTask[];
  notes: BiboFile[];
  projects: Array<{ id: string; name: string; total: number; done: number }>;
  counts: { unread: number; activeTasks: number };
};

export type BiboSpaceAction = { action: string; input?: Record<string, unknown> };
