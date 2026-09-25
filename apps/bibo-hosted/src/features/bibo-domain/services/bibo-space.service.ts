import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type {
  BiboEvent, BiboFile, BiboFileDetail, BiboInboxItem, BiboOverview,
  BiboProject, BiboTask,
} from "@nextclaw/bibo-client";

type State = {
  schema: 1;
  projects: BiboProject[];
  tasks: BiboTask[];
  events: BiboEvent[];
  inbox: BiboInboxItem[];
  deliveryStatuses: Record<string, { readAt: string | null; resolvedAt: string | null; version: number }>;
  files: BiboFile[];
  replays: Record<string, unknown>;
};

type Actor = { kind: "user" | "agent"; sessionId?: string };
type ActionResult = { result: unknown; changed: boolean };
const emptyState = (): State => ({ schema: 1, projects: [], tasks: [], events: [], inbox: [], deliveryStatuses: {}, files: [], replays: {} });
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export class BiboSpaceError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BiboSpaceError("请求格式不正确。", 400);
  return value as Record<string, unknown>;
}

function required(value: unknown, label: string, max = 160): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new BiboSpaceError(`${label}不能为空，且最多 ${max} 字。`, 400);
  return value.trim();
}

function optional(value: unknown, label: string, max = 20_000): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max) throw new BiboSpaceError(`${label}格式不正确。`, 400);
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new BiboSpaceError(`${label}不是有效时间。`, 400);
  return new Date(value).toISOString();
}

function taskStatus(value: unknown): BiboTask["status"] {
  if (!["planned", "active", "done", "cancelled"].includes(String(value))) throw new BiboSpaceError("任务状态不正确。", 400);
  return value as BiboTask["status"];
}

function taskPriority(value: unknown): BiboTask["priority"] {
  if (!["low", "medium", "high"].includes(String(value))) throw new BiboSpaceError("任务优先级不正确。", 400);
  return value as BiboTask["priority"];
}

function validateTaskDates(task: Pick<BiboTask, "startAt" | "dueAt">): void {
  if (task.startAt && task.dueAt && task.dueAt < task.startAt) throw new BiboSpaceError("截止时间不能早于开始时间。", 400);
}

function subtasks(value: unknown): BiboTask["subtasks"] {
  if (!Array.isArray(value) || value.length > 100) throw new BiboSpaceError("子任务格式不正确。", 400);
  return value.map((item: unknown) => { const part = record(item); return { id: typeof part.id === "string" ? part.id : id(), title: required(part.title, "子任务", 160), done: part.done === true }; });
}

function expectedVersion(item: { version: number }, input: Record<string, unknown>): void {
  if (typeof input.version !== "number" || !Number.isInteger(input.version)) throw new BiboSpaceError("请提供对象版本。", 400);
  if (item.version !== input.version) throw new BiboSpaceError("内容已有更新，请重新加载后再保存。", 409);
}

function find<T extends { id: string }>(items: T[], input: Record<string, unknown>): T {
  const target = items.find((item) => item.id === input.id);
  if (!target) throw new BiboSpaceError("对象不存在或已删除。", 404);
  return target;
}

function page<T>(items: T[], input: Record<string, unknown>): { items: T[]; nextCursor: string | null } {
  const limit = typeof input.limit === "number" && Number.isInteger(input.limit) ? Math.min(100, Math.max(1, input.limit)) : 50;
  const offset = typeof input.cursor === "string" ? Number(input.cursor) : 0;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new BiboSpaceError("分页位置不正确。", 400);
  return { items: items.slice(offset, offset + limit), nextCursor: offset + limit < items.length ? String(offset + limit) : null };
}

export class BiboSpaceService {
  private readonly root: string;
  private readonly statePath: string;
  private readonly deliveriesPath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(home: string) {
    this.root = resolve(home, "workspace");
    this.statePath = resolve(home, "bibo", "state.json");
    this.deliveriesPath = resolve(home, "inbox", "deliveries.json");
  }

  private load = async (): Promise<State> => {
    let source: string;
    try { source = await readFile(this.statePath, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
      throw error;
    }
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== "object" || (value as State).schema !== 1) throw new BiboSpaceError("个人空间数据格式无法读取。", 500);
    const state = value as State;
    if (![state.projects, state.tasks, state.events, state.inbox, state.files].every(Array.isArray) || !state.replays || typeof state.replays !== "object" || !state.deliveryStatuses || typeof state.deliveryStatuses !== "object") {
      throw new BiboSpaceError("个人空间数据不完整。", 500);
    }
    return state;
  };

  private save = async (state: State): Promise<void> => {
    await mkdir(dirname(this.statePath), { recursive: true });
    const temp = `${this.statePath}.${id()}.tmp`;
    try { await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8"); await rename(temp, this.statePath); }
    catch (error) { await rm(temp, { force: true }).catch(() => undefined); throw error; }
  };

  private safePath = (value: unknown): string => {
    if (typeof value !== "string" || !value || value.length > 512 || value.includes("\\") || value.includes("\0") || value.startsWith("/")) {
      throw new BiboSpaceError("文件路径不正确。", 400);
    }
    const parts = value.split("/");
    if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) throw new BiboSpaceError("文件路径不正确。", 400);
    const path = resolve(this.root, ...parts);
    if (relative(this.root, path).startsWith("..")) throw new BiboSpaceError("文件路径不正确。", 400);
    return value;
  };

  private fullPath = (path: string): string => join(this.root, path);

  private physical = async (path: string, allowMissing: boolean): Promise<string> => {
    const full = this.fullPath(path);
    const root = await realpath(this.root);
    const parent = await realpath(dirname(full));
    if (parent !== root && !parent.startsWith(`${root}/`)) throw new BiboSpaceError("文件路径超出个人空间。", 400);
    try {
      const info = await lstat(full);
      if (info.isSymbolicLink()) throw new BiboSpaceError("不支持符号链接。", 400);
      if (allowMissing) throw new BiboSpaceError("目标位置已有内容。", 409);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (!allowMissing) throw new BiboSpaceError("文件不存在。", 404);
    }
    return full;
  };

  private checkParent = (state: State, path: string): void => {
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (parent && !state.files.some((item) => item.path === parent && item.kind === "folder")) throw new BiboSpaceError("请先创建上级文件夹。", 400);
  };

  private fileDetail = async (file: BiboFile): Promise<BiboFileDetail> => ({
    ...file,
    content: file.kind === "folder" ? null : await readFile(await this.physical(file.path, false), "utf8"),
  });

  private writeContent = async (path: string, content: string): Promise<void> => {
    if (Buffer.byteLength(content, "utf8") > 1024 * 1024) throw new BiboSpaceError("单个文本文件最多 1 MiB。", 413);
    const full = this.fullPath(path);
    await mkdir(dirname(full), { recursive: true });
    const root = await realpath(this.root);
    const parent = await realpath(dirname(full));
    if (parent !== root && !parent.startsWith(`${root}/`)) throw new BiboSpaceError("文件路径超出个人空间。", 400);
    try { if ((await lstat(full)).isSymbolicLink()) throw new BiboSpaceError("不支持符号链接。", 400); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const temp = `${full}.${id()}.tmp`;
    try { await writeFile(temp, content, "utf8"); await rename(temp, full); }
    catch (error) { await rm(temp, { force: true }).catch(() => undefined); throw error; }
  };

  private inboxItems = async (state: State): Promise<BiboInboxItem[]> => {
    let source: string;
    try { source = await readFile(this.deliveriesPath, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return state.inbox;
      throw error;
    }
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== "object" || !Array.isArray((value as { deliveries?: unknown }).deliveries)) throw new BiboSpaceError("Bibo 暂时无法读取 Agent 送达。", 500);
    const deliveries = ((value as { deliveries: unknown[] }).deliveries).filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item) && typeof (item as Record<string, unknown>).id === "string");
    const bridged: BiboInboxItem[] = deliveries.map((item) => {
      const deliveryId = `delivery:${item.id}`;
      const overlay = state.deliveryStatuses[deliveryId];
      const source = item.source && typeof item.source === "object" ? item.source as Record<string, unknown> : {};
      const body = typeof item.content === "string" ? item.content : "";
      return {
        id: deliveryId, kind: "agent", title: String(item.title ?? "Bibo 送达"),
        body: item.contentType === "html" ? body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : body,
        source: typeof source.sessionId === "string" && source.sessionId ? { kind: "session", id: source.sessionId } : { kind: "bibo" },
        createdAt: String(item.createdAt ?? now()), updatedAt: String(item.updatedAt ?? item.createdAt ?? now()),
        readAt: overlay?.readAt ?? (typeof item.readAt === "string" ? item.readAt : null),
        resolvedAt: overlay?.resolvedAt ?? (typeof item.archivedAt === "string" ? item.archivedAt : null),
        version: overlay?.version ?? 1,
      };
    });
    return [...state.inbox, ...bridged];
  };

  listActions = (domain?: string, query?: string): { action: string; domain: string; description: string; input: string }[] => {
    const entries = [
      ["overview.get", "overview", "读取当下概览", "{}"],
      ["project.list", "projects", "列出项目", "{limit?,cursor?}"],
      ["project.create", "projects", "创建项目", "{name,requestId?}"],
      ["project.update", "projects", "修改项目名称", "{id,version,name}"],
      ["project.delete", "projects", "删除项目并解除任务归属", "{id,version}"],
      ["task.list", "tasks", "列出任务，按标题/描述搜索及项目/状态筛选", "{query?,projectId?,status?,limit?,cursor?}"],
      ["task.get", "tasks", "读取任务详情", "{id}"],
      ["task.create", "tasks", "创建任务", "{title,description?,projectId?,status?:planned|active|done|cancelled,priority?:low|medium|high,startAt?,dueAt?,subtasks?,requestId?}"],
      ["task.update", "tasks", "更新任务与子任务", "{id,version,title?,description?,status?:planned|active|done|cancelled,priority?:low|medium|high,startAt?,dueAt?,projectId?,subtasks?}"],
      ["task.delete", "tasks", "删除任务", "{id,version}"],
      ["event.list", "events", "列出时间范围内日程", "{from?,to?,limit?,cursor?}"],
      ["event.get", "events", "读取日程详情", "{id}"],
      ["event.create", "events", "创建日程", "{title,startAt,endAt,description?,requestId?}"],
      ["event.update", "events", "更新日程", "{id,version,title?,startAt?,endAt?,description?}"],
      ["event.delete", "events", "删除日程", "{id,version}"],
      ["inbox.list", "inbox", "列出需要关注的条目", "{unresolved?,limit?,cursor?}"],
      ["inbox.get", "inbox", "读取条目详情", "{id}"],
      ["inbox.create", "inbox", "送达一条第一方提醒", "{title,body,kind?,source?,requestId?}"],
      ["inbox.read", "inbox", "标记已读", "{id,version}"],
      ["inbox.resolve", "inbox", "标记已处理", "{id,version}"],
      ["file.list", "files", "列出文件树节点；笔记可按最近编辑排序", "{kind?,query?,ancestorOf?,sort?:'recent',limit?,cursor?}"],
      ["file.get", "files", "读取文件内容", "{id}"],
      ["file.create", "files", "创建文件夹、笔记、文档或产物", "{path,kind,content?,requestId?}"],
      ["file.update", "files", "保存文本内容", "{id,version,content}"],
      ["file.move", "files", "改名或移动文件及目录", "{id,version,path}"],
      ["file.delete", "files", "删除文件或目录及后代", "{id,version}"],
    ].map(([action, itemDomain, description, input]) => ({ action, domain: itemDomain, description, input }));
    const needle = query?.trim().toLowerCase();
    return entries.filter((entry) => (!domain || entry.domain === domain) && (!needle || Object.values(entry).some((value) => value.toLowerCase().includes(needle))));
  };

  execute = (action: string, rawInput: unknown = {}, actor: Actor = { kind: "user" }): Promise<unknown> => {
    const operation = this.queue.then(() => this.executeOne(action, rawInput, actor));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  private executeOne = async (action: string, rawInput: unknown, actor: Actor): Promise<unknown> => {
    const input = record(rawInput);
    const state = await this.load();
    const allInbox = action.startsWith("inbox.") || action === "overview.get" ? await this.inboxItems(state) : state.inbox;
    const requestId = typeof input.requestId === "string" && input.requestId.length <= 100 ? input.requestId : null;
    if (requestId && Object.hasOwn(state.replays, requestId)) return state.replays[requestId];
    let outcome: ActionResult;
    if (action === "overview.get") outcome = this.overviewAction(state, allInbox);
    else if (action.startsWith("project.")) outcome = this.projectAction(action, state, input);
    else if (action.startsWith("task.")) outcome = this.taskAction(action, state, input, actor);
    else if (action.startsWith("event.")) outcome = this.eventAction(action, state, input, actor);
    else if (action.startsWith("inbox.")) outcome = this.inboxAction(action, state, allInbox, input, actor);
    else if (action.startsWith("file.")) outcome = await this.fileAction(action, state, input);
    else throw new BiboSpaceError("未知操作。可先查询 help。", 400);
    const { result, changed } = outcome;
    if (changed) {
      if (requestId) {
        state.replays[requestId] = result;
        const keys = Object.keys(state.replays);
        if (keys.length > 100) delete state.replays[keys[0]!];
      }
      await this.save(state);
    }
    return result;
  };

  private overviewAction = (state: State, allInbox: BiboInboxItem[]): ActionResult => {
    const upcoming = state.events.filter((event) => Date.parse(event.endAt) >= Date.now()).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const result = { inbox: allInbox.filter((item) => !item.resolvedAt).slice(0, 4), events: upcoming.slice(0, 4), tasks: state.tasks.filter((task) => !["done", "cancelled"].includes(task.status)).slice(0, 4), notes: state.files.filter((file) => file.kind === "note").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3), projects: state.projects.map((project) => ({ id: project.id, name: project.name, total: state.tasks.filter((task) => task.projectId === project.id).length, done: state.tasks.filter((task) => task.projectId === project.id && task.status === "done").length })).filter((project) => project.total > 0).slice(0, 3), counts: { unread: allInbox.filter((item) => !item.readAt && !item.resolvedAt).length, activeTasks: state.tasks.filter((task) => !["done", "cancelled"].includes(task.status)).length } } satisfies BiboOverview;
    return { result, changed: false };
  };
  private projectAction = (action: string, state: State, input: Record<string, unknown>): ActionResult => {
    let result: unknown;
    let changed = false;
    switch (action) {
      case "project.list": result = page(state.projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), input); break;
      case "project.create": {
        const time = now(); result = { id: id(), name: required(input.name, "项目名称"), createdAt: time, updatedAt: time, version: 1 } satisfies BiboProject;
        state.projects.push(result as BiboProject); changed = true; break;
      }
      case "project.update": {
        const project = find(state.projects, input); expectedVersion(project, input);
        project.name = required(input.name, "项目名称"); project.updatedAt = now(); project.version += 1;
        result = project; changed = true; break;
      }
      case "project.delete": {
        const project = find(state.projects, input); expectedVersion(project, input);
        state.projects = state.projects.filter((item) => item.id !== project.id);
        for (const task of state.tasks) if (task.projectId === project.id) { task.projectId = null; task.version += 1; task.updatedAt = now(); }
        result = { deleted: project.id }; changed = true; break;
      }
      default: throw new BiboSpaceError("未知操作。可先查询 help。", 400);
    }
    return { result, changed };
  };
  private taskAction = (action: string, state: State, input: Record<string, unknown>, actor: Actor): ActionResult => {
    let result: unknown;
    let changed = false;
    switch (action) {
      case "task.list": result = page(state.tasks.filter((item) => (input.projectId === undefined || item.projectId === input.projectId) && (input.status === undefined || item.status === input.status) && (input.query === undefined || `${item.title} ${item.description}`.toLocaleLowerCase().includes(String(input.query).toLocaleLowerCase()))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), input); break;
      case "task.get": result = find(state.tasks, input); break;
      case "task.create": {
        const projectId = typeof input.projectId === "string" ? input.projectId : null;
        if (projectId && !state.projects.some((item) => item.id === projectId)) throw new BiboSpaceError("项目不存在。", 400);
        const time = now(); result = { id: id(), projectId, title: required(input.title, "任务标题"), description: optional(input.description, "任务描述"), status: input.status === undefined ? "planned" : taskStatus(input.status), dueAt: input.dueAt ? timestamp(input.dueAt, "截止时间") : null, priority: input.priority === undefined ? "medium" : taskPriority(input.priority), startAt: input.startAt ? timestamp(input.startAt, "开始时间") : null, completedAt: input.status === "done" ? time : null, subtasks: input.subtasks === undefined ? [] : subtasks(input.subtasks), source: actor, createdAt: time, updatedAt: time, version: 1 } satisfies BiboTask;
        validateTaskDates(result as BiboTask);
        state.tasks.push(result as BiboTask); changed = true; break;
      }
      case "task.update": {
        result = this.updateTask(state, input); changed = true; break;
      }
      case "task.delete": { const task = find(state.tasks, input); expectedVersion(task, input); state.tasks = state.tasks.filter((item) => item.id !== task.id); result = { deleted: task.id }; changed = true; break; }
      default: throw new BiboSpaceError("未知操作。可先查询 help。", 400);
    }
    return { result, changed };
  };

  private updateTask = (state: State, input: Record<string, unknown>): BiboTask => {
    const task = find(state.tasks, input); expectedVersion(task, input);
    if (input.title !== undefined) task.title = required(input.title, "任务标题");
    if (input.description !== undefined) task.description = optional(input.description, "任务描述");
    if (input.status !== undefined) {
      task.status = taskStatus(input.status);
      task.completedAt = task.status === "done" ? task.completedAt ?? now() : null;
    }
    if (input.priority !== undefined) task.priority = taskPriority(input.priority);
    if (input.startAt !== undefined) task.startAt = input.startAt === null ? null : timestamp(input.startAt, "开始时间");
    if (input.dueAt !== undefined) task.dueAt = input.dueAt === null ? null : timestamp(input.dueAt, "截止时间");
    if (input.projectId !== undefined) {
      if (input.projectId !== null && !state.projects.some((project) => project.id === input.projectId)) throw new BiboSpaceError("项目不存在。", 400);
      task.projectId = input.projectId as string | null;
    }
    if (input.subtasks !== undefined) task.subtasks = subtasks(input.subtasks);
    validateTaskDates(task);
    task.version += 1; task.updatedAt = now();
    return task;
  };
  private eventAction = (action: string, state: State, input: Record<string, unknown>, actor: Actor): ActionResult => {
    let result: unknown;
    let changed = false;
    switch (action) {
      case "event.list": result = page(state.events.filter((item) => (input.from === undefined || item.endAt >= String(input.from)) && (input.to === undefined || item.startAt <= String(input.to))).sort((a, b) => a.startAt.localeCompare(b.startAt)), input); break;
      case "event.get": result = find(state.events, input); break;
      case "event.create": {
        const startAt = timestamp(input.startAt, "开始时间"); const endAt = timestamp(input.endAt, "结束时间");
        if (endAt <= startAt) throw new BiboSpaceError("结束时间须晚于开始时间。", 400);
        const time = now(); result = { id: id(), title: required(input.title, "日程标题"), description: optional(input.description, "日程描述"), startAt, endAt, source: actor, createdAt: time, updatedAt: time, version: 1 } satisfies BiboEvent;
        state.events.push(result as BiboEvent); changed = true; break;
      }
      case "event.update": {
        const event = find(state.events, input); expectedVersion(event, input);
        if (input.title !== undefined) event.title = required(input.title, "日程标题");
        if (input.description !== undefined) event.description = optional(input.description, "日程描述");
        if (input.startAt !== undefined) event.startAt = timestamp(input.startAt, "开始时间");
        if (input.endAt !== undefined) event.endAt = timestamp(input.endAt, "结束时间");
        if (event.endAt <= event.startAt) throw new BiboSpaceError("结束时间须晚于开始时间。", 400);
        event.version += 1; event.updatedAt = now(); result = event; changed = true; break;
      }
      case "event.delete": { const event = find(state.events, input); expectedVersion(event, input); state.events = state.events.filter((item) => item.id !== event.id); result = { deleted: event.id }; changed = true; break; }
      default: throw new BiboSpaceError("未知操作。可先查询 help。", 400);
    }
    return { result, changed };
  };
  private inboxAction = (action: string, state: State, allInbox: BiboInboxItem[], input: Record<string, unknown>, actor: Actor): ActionResult => {
    let result: unknown;
    let changed = false;
    switch (action) {
      case "inbox.list": result = page(allInbox.filter((item) => input.unresolved !== true || !item.resolvedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), input); break;
      case "inbox.get": result = find(allInbox, input); break;
      case "inbox.create": {
        const kind = input.kind ?? "agent";
        if (!["agent", "decision", "reminder"].includes(String(kind))) throw new BiboSpaceError("提醒类型不正确。", 400);
        const source = input.source === undefined ? { kind: actor.kind === "agent" ? "session" : "bibo", ...(actor.sessionId ? { id: actor.sessionId } : {}) } : record(input.source);
        if (!["bibo", "session", "task", "event", "file"].includes(String(source.kind))) throw new BiboSpaceError("来源类型不正确。", 400);
        const time = now(); result = { id: id(), kind, title: required(input.title, "提醒标题"), body: required(input.body, "提醒内容", 20_000), source, createdAt: time, updatedAt: time, readAt: null, resolvedAt: null, version: 1 } as BiboInboxItem;
        state.inbox.push(result as BiboInboxItem); changed = true; break;
      }
      case "inbox.read": case "inbox.resolve": {
        const item = find(allInbox, input); expectedVersion(item, input);
        if (action === "inbox.read") item.readAt = item.readAt ?? now();
        else { item.readAt = item.readAt ?? now(); item.resolvedAt = item.resolvedAt ?? now(); }
        item.updatedAt = now(); item.version += 1;
        if (item.id.startsWith("delivery:")) state.deliveryStatuses[item.id] = { readAt: item.readAt, resolvedAt: item.resolvedAt, version: item.version };
        result = item; changed = true; break;
      }
      default: throw new BiboSpaceError("未知操作。可先查询 help。", 400);
    }
    return { result, changed };
  };
  private fileAction = async (action: string, state: State, input: Record<string, unknown>): Promise<ActionResult> => {
    if (action === "file.list") {
      if (input.sort !== undefined && input.sort !== "recent") throw new BiboSpaceError("文件排序方式不正确。", 400);
      const files = state.files.filter((item) => (input.kind === undefined || item.kind === input.kind) && (input.query === undefined || item.path.toLocaleLowerCase().includes(String(input.query).toLocaleLowerCase())) && (input.ancestorOf === undefined || item.kind === "folder" && String(input.ancestorOf).startsWith(`${item.path}/`)));
      files.sort((a, b) => input.sort === "recent" ? b.updatedAt.localeCompare(a.updatedAt) || a.path.localeCompare(b.path, "zh-CN") : a.path.localeCompare(b.path, "zh-CN"));
      return { result: page(files, input), changed: false };
    }
    if (action === "file.get") return { result: await this.fileDetail(find(state.files, input)), changed: false };
    if (action === "file.create") return { result: await this.createFile(state, input), changed: true };
    if (action === "file.update") return { result: await this.updateFile(state, input), changed: true };
    if (action === "file.move") return { result: await this.moveFile(state, input), changed: true };
    if (action === "file.delete") return { result: await this.deleteFile(state, input), changed: true };
    throw new BiboSpaceError("未知操作。可先查询 help。", 400);
  };

  private createFile = async (state: State, input: Record<string, unknown>): Promise<BiboFileDetail> => {
    const path = this.safePath(input.path);
    const kind = input.kind;
    if (!["folder", "note", "document", "artifact"].includes(String(kind))) throw new BiboSpaceError("文件类型不正确。", 400);
    if (state.files.some((item) => item.path === path)) throw new BiboSpaceError("该位置已有同名项目。", 409);
    this.checkParent(state, path);
    const time = now(); const file = { id: id(), path, kind, createdAt: time, updatedAt: time, version: 1 } as BiboFile;
    await this.physical(path, true);
    if (kind === "folder") await mkdir(this.fullPath(path));
    else await this.writeContent(path, optional(input.content, "文件内容", 1_000_000));
    state.files.push(file);
    return this.fileDetail(file);
  };

  private updateFile = async (state: State, input: Record<string, unknown>): Promise<BiboFileDetail> => {
    const file = find(state.files, input); expectedVersion(file, input);
    if (file.kind === "folder") throw new BiboSpaceError("文件夹没有正文。", 400);
    if (typeof input.content !== "string") throw new BiboSpaceError("请提供文件内容。", 400);
    await this.physical(file.path, false);
    await this.writeContent(file.path, optional(input.content, "文件内容", 1_000_000));
    file.updatedAt = now(); file.version += 1;
    return this.fileDetail(file);
  };

  private moveFile = async (state: State, input: Record<string, unknown>): Promise<BiboFileDetail> => {
    const file = find(state.files, input); expectedVersion(file, input);
    const path = this.safePath(input.path);
    if (path === file.path || path.startsWith(`${file.path}/`)) throw new BiboSpaceError("不能移动到原位置或自己的子目录。", 400);
    if (state.files.some((item) => item.path === path || (file.kind === "folder" && item.path.startsWith(`${path}/`)))) throw new BiboSpaceError("目标位置已有内容。", 409);
    this.checkParent(state, path);
    const previous = file.path;
    await this.physical(previous, false);
    await this.physical(path, true);
    await rename(this.fullPath(previous), this.fullPath(path));
    for (const item of state.files) if (item.id === file.id || item.path.startsWith(`${previous}/`)) { item.path = `${path}${item.path.slice(previous.length)}`; item.version += 1; item.updatedAt = now(); }
    return this.fileDetail(file);
  };

  private deleteFile = async (state: State, input: Record<string, unknown>): Promise<{ deleted: string[] }> => {
    const file = find(state.files, input); expectedVersion(file, input);
    const removed = state.files.filter((item) => item.path === file.path || item.path.startsWith(`${file.path}/`));
    await this.physical(file.path, false);
    await rm(this.fullPath(file.path), { recursive: file.kind === "folder", force: false });
    state.files = state.files.filter((item) => !removed.includes(item));
    return { deleted: removed.map((item) => item.id) };
  };
}
