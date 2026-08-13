#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CalendarSubscriptionService } from "./calendar-subscription.service.mjs";

const dataDirectory = process.env.NEXTCLAW_APP_DATA_DIR?.trim();
const MAX_NOTE_BYTES = 2 * 1024 * 1024;
if (!dataDirectory) {
  throw new Error("NEXTCLAW_APP_DATA_DIR is required.");
}
await mkdir(dataDirectory, { recursive: true });

const files = {
  todos: path.join(dataDirectory, "todos.json"),
  favorites: path.join(dataDirectory, "favorites.json"),
  calendar: path.join(dataDirectory, "calendar.json"),
  notesIndex: path.join(dataDirectory, "notes-index.json"),
  notesDirectory: path.join(dataDirectory, "notes"),
};
await mkdir(files.notesDirectory, { recursive: true });

const objectSchema = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const string = { type: "string" };
const boolean = { type: "boolean" };

const tools = [
  ["todo_list", "List todos", objectSchema({ status: { type: "string", enum: ["all", "open", "completed"] } })],
  ["todo_create", "Create a todo", objectSchema({ title: string, notes: string, dueDate: string, priority: { type: "string", enum: ["low", "normal", "high"] } }, ["title"])],
  ["todo_update", "Update a todo", objectSchema({ id: string, title: string, notes: string, dueDate: string, priority: { type: "string", enum: ["low", "normal", "high"] }, completed: boolean }, ["id"])],
  ["todo_delete", "Delete a todo", objectSchema({ id: string }, ["id"])],
  ["note_list", "List Markdown notes", objectSchema({ query: string })],
  ["note_read", "Read a Markdown note", objectSchema({ id: string }, ["id"])],
  ["note_save", "Create or update a Markdown note", objectSchema({ id: string, title: string, content: string }, ["title", "content"])],
  ["note_delete", "Delete a Markdown note", objectSchema({ id: string }, ["id"])],
  ["favorite_list", "List favorites", objectSchema({ query: string, tag: string })],
  ["favorite_save", "Save a favorite", objectSchema({ url: string, title: string, note: string, tags: { type: "array", items: string } }, ["url", "title"])],
  ["favorite_update", "Update a favorite", objectSchema({ id: string, url: string, title: string, note: string, tags: { type: "array", items: string } }, ["id"])],
  ["favorite_delete", "Delete a favorite", objectSchema({ id: string }, ["id"])],
  ["event_list", "List calendar events", objectSchema({ start: string, end: string })],
  ["event_create", "Create an event", objectSchema({ title: string, start: string, end: string, allDay: boolean, location: string, notes: string }, ["title", "start"])],
  ["event_update", "Update an event", objectSchema({ id: string, title: string, start: string, end: string, allDay: boolean, location: string, notes: string }, ["id"])],
  ["event_delete", "Delete an event", objectSchema({ id: string }, ["id"])],
  ["calendar_subscribe", "Connect an ICS calendar URL", objectSchema({ name: string, url: string }, ["name", "url"])],
  ["calendar_sync", "Sync connected ICS calendars", objectSchema({ id: string })],
  ["calendar_unsubscribe", "Disconnect an ICS calendar", objectSchema({ id: string }, ["id"])],
].map(([name, description, inputSchema]) => ({ name, description, inputSchema }));

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return structuredClone(fallback);
    throw error;
  }
}

async function writeJson(filePath, value) {
  await writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextAtomic(filePath, value) {
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await writeFile(tempPath, value, { encoding: "utf8", mode: 0o600 });
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

const now = () => new Date().toISOString();
const requireText = (value, field) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
};
const optionalText = (value) => typeof value === "string" ? value.trim() : "";
const requireId = (value) => requireText(value, "id");
const requireNoteId = (value) => {
  const noteId = requireId(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(noteId) || noteId === "." || noteId === "..") {
    throw new Error("note id is invalid");
  }
  return noteId;
};
const normalizeTags = (value) => Array.isArray(value)
  ? [...new Set(value.map((entry) => optionalText(entry)).filter(Boolean))].slice(0, 20)
  : [];
const assertHttpUrl = (value) => {
  const url = new URL(requireText(value, "url"));
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("url must use http or https");
  return url.toString();
};
const calendarSubscriptionService = new CalendarSubscriptionService({
  normalizeHttpUrl: assertHttpUrl,
  now,
  toIso,
});

async function mutateCollection(filePath, callback) {
  const state = await readJson(filePath, { schemaVersion: 1, items: [] });
  const result = await callback(state.items);
  await writeJson(filePath, { schemaVersion: 1, items: state.items });
  return result;
}

const actions = {
  todo_list: async ({ status = "all" }) => {
    const state = await readJson(files.todos, { schemaVersion: 1, items: [] });
    const items = state.items
      .filter((item) => status === "all" || (status === "completed") === item.completed)
      .sort((left, right) => Number(left.completed) - Number(right.completed) || optionalText(left.dueDate).localeCompare(optionalText(right.dueDate)) || right.createdAt.localeCompare(left.createdAt));
    return { items };
  },
  todo_create: async (input) => await mutateCollection(files.todos, (items) => {
    const timestamp = now();
    const item = { id: randomUUID(), title: requireText(input.title, "title"), notes: optionalText(input.notes), dueDate: optionalText(input.dueDate), priority: ["low", "high"].includes(input.priority) ? input.priority : "normal", completed: false, createdAt: timestamp, updatedAt: timestamp };
    items.push(item);
    return { item };
  }),
  todo_update: async (input) => await mutateCollection(files.todos, (items) => {
    const item = items.find((entry) => entry.id === requireId(input.id));
    if (!item) throw new Error("todo not found");
    for (const field of ["title", "notes", "dueDate"]) if (typeof input[field] === "string") item[field] = field === "title" ? requireText(input[field], field) : input[field].trim();
    if (typeof input.completed === "boolean") item.completed = input.completed;
    if (["low", "normal", "high"].includes(input.priority)) item.priority = input.priority;
    item.updatedAt = now();
    return { item };
  }),
  todo_delete: async ({ id }) => await mutateCollection(files.todos, (items) => {
    const index = items.findIndex((item) => item.id === requireId(id));
    if (index < 0) throw new Error("todo not found");
    items.splice(index, 1);
    return { deleted: true, id };
  }),
  note_list: async ({ query = "" }) => {
    const state = await readJson(files.notesIndex, { schemaVersion: 1, items: [] });
    const normalizedQuery = optionalText(query).toLowerCase();
    return { items: state.items.filter((item) => !normalizedQuery || item.title.toLowerCase().includes(normalizedQuery)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) };
  },
  note_read: async ({ id }) => {
    const noteId = requireNoteId(id);
    const state = await readJson(files.notesIndex, { schemaVersion: 1, items: [] });
    const item = state.items.find((entry) => entry.id === noteId);
    if (!item) throw new Error("note not found");
    return { item: { ...item, content: await readFile(path.join(files.notesDirectory, `${noteId}.md`), "utf8") } };
  },
  note_save: async (input) => {
    const state = await readJson(files.notesIndex, { schemaVersion: 1, items: [] });
    const timestamp = now();
    const noteId = requireNoteId(optionalText(input.id) || randomUUID());
    const content = String(input.content ?? "");
    if (Buffer.byteLength(content, "utf8") > MAX_NOTE_BYTES) {
      throw new Error(`note content exceeds ${MAX_NOTE_BYTES} bytes`);
    }
    let item = state.items.find((entry) => entry.id === noteId);
    if (!item) {
      item = { id: noteId, title: requireText(input.title, "title"), createdAt: timestamp, updatedAt: timestamp };
      state.items.push(item);
    } else {
      item.title = requireText(input.title, "title");
      item.updatedAt = timestamp;
    }
    const notePath = path.join(files.notesDirectory, `${noteId}.md`);
    let previousContent;
    try {
      previousContent = await readFile(notePath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await writeTextAtomic(notePath, content);
    try {
      await writeJson(files.notesIndex, state);
    } catch (error) {
      try {
        if (previousContent === undefined) await rm(notePath, { force: true });
        else await writeTextAtomic(notePath, previousContent);
      } catch (restoreError) {
        throw new AggregateError([error, restoreError], "note save failed and content could not be restored");
      }
      throw error;
    }
    return { item: { ...item, content } };
  },
  note_delete: async ({ id }) => {
    const noteId = requireNoteId(id);
    const state = await readJson(files.notesIndex, { schemaVersion: 1, items: [] });
    const nextItems = state.items.filter((item) => item.id !== noteId);
    if (nextItems.length === state.items.length) throw new Error("note not found");
    await writeJson(files.notesIndex, { ...state, items: nextItems });
    try {
      await rm(path.join(files.notesDirectory, `${noteId}.md`), { force: true });
    } catch (error) {
      try {
        await writeJson(files.notesIndex, state);
      } catch (restoreError) {
        throw new AggregateError([error, restoreError], "note delete failed and index could not be restored");
      }
      throw error;
    }
    return { deleted: true, id: noteId };
  },
  favorite_list: async ({ query = "", tag = "" }) => {
    const state = await readJson(files.favorites, { schemaVersion: 1, items: [] });
    const normalizedQuery = optionalText(query).toLowerCase();
    const normalizedTag = optionalText(tag).toLowerCase();
    return { items: state.items.filter((item) => (!normalizedQuery || `${item.title} ${item.url} ${item.note}`.toLowerCase().includes(normalizedQuery)) && (!normalizedTag || item.tags.some((entry) => entry.toLowerCase() === normalizedTag))).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) };
  },
  favorite_save: async (input) => await mutateCollection(files.favorites, (items) => {
    const timestamp = now();
    const item = { id: randomUUID(), url: assertHttpUrl(input.url), title: requireText(input.title, "title"), note: optionalText(input.note), tags: normalizeTags(input.tags), createdAt: timestamp, updatedAt: timestamp };
    items.push(item);
    return { item };
  }),
  favorite_update: async (input) => await mutateCollection(files.favorites, (items) => {
    const item = items.find((entry) => entry.id === requireId(input.id));
    if (!item) throw new Error("favorite not found");
    if (typeof input.url === "string") item.url = assertHttpUrl(input.url);
    if (typeof input.title === "string") item.title = requireText(input.title, "title");
    if (typeof input.note === "string") item.note = input.note.trim();
    if (Array.isArray(input.tags)) item.tags = normalizeTags(input.tags);
    item.updatedAt = now();
    return { item };
  }),
  favorite_delete: async ({ id }) => await mutateCollection(files.favorites, (items) => {
    const index = items.findIndex((item) => item.id === requireId(id));
    if (index < 0) throw new Error("favorite not found");
    items.splice(index, 1);
    return { deleted: true, id };
  }),
  event_list: async ({ start = "", end = "" }) => {
    const state = await readJson(files.calendar, { schemaVersion: 1, items: [], subscriptions: [] });
    const from = start ? new Date(start).getTime() : Number.NEGATIVE_INFINITY;
    const to = end ? new Date(end).getTime() : Number.POSITIVE_INFINITY;
    return {
      items: state.items
        .filter((item) => {
          const eventStart = new Date(item.start).getTime();
          const eventEnd = Math.max(new Date(item.end || item.start).getTime(), eventStart + 1);
          return eventStart < to && eventEnd > from;
        })
        .sort((left, right) => left.start.localeCompare(right.start)),
      subscriptions: state.subscriptions,
    };
  },
  event_create: async (input) => await mutateCalendar((state) => {
    const timestamp = now();
    const start = toIso(input.start, "start");
    const allDay = input.allDay === true;
    const end = input.end
      ? toIso(input.end, "end")
      : allDay
        ? start
        : new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
    assertEventRange(start, end, allDay);
    const item = { id: randomUUID(), title: requireText(input.title, "title"), start, end, allDay, location: optionalText(input.location), notes: optionalText(input.notes), source: "local", createdAt: timestamp, updatedAt: timestamp };
    state.items.push(item);
    return { item };
  }),
  event_update: async (input) => await mutateCalendar((state) => {
    const item = state.items.find((entry) => entry.id === requireId(input.id) && entry.source === "local");
    if (!item) throw new Error("editable event not found");
    if (typeof input.title === "string") item.title = requireText(input.title, "title");
    if (typeof input.start === "string") item.start = toIso(input.start, "start");
    if (typeof input.end === "string") item.end = toIso(input.end, "end");
    if (typeof input.allDay === "boolean") item.allDay = input.allDay;
    if (typeof input.location === "string") item.location = input.location.trim();
    if (typeof input.notes === "string") item.notes = input.notes.trim();
    assertEventRange(item.start, item.end, item.allDay);
    item.updatedAt = now();
    return { item };
  }),
  event_delete: async ({ id }) => await mutateCalendar((state) => {
    const index = state.items.findIndex((item) => item.id === requireId(id) && item.source === "local");
    if (index < 0) throw new Error("editable event not found");
    state.items.splice(index, 1);
    return { deleted: true, id };
  }),
  calendar_subscribe: async ({ name, url }) => await mutateCalendar(async (state) => {
    const subscription = { id: randomUUID(), name: requireText(name, "name"), url: assertHttpUrl(url), lastSyncedAt: "", lastError: "" };
    state.subscriptions.push(subscription);
    try {
      await calendarSubscriptionService.sync(state, subscription);
      return { subscription, imported: state.items.filter((item) => item.subscriptionId === subscription.id).length, synced: true, error: "" };
    } catch (error) {
      return { subscription, imported: 0, synced: false, error: error instanceof Error ? error.message : String(error) };
    }
  }),
  calendar_sync: async ({ id = "" }) => await mutateCalendar(async (state) => {
    const subscriptions = id ? state.subscriptions.filter((entry) => entry.id === id) : state.subscriptions;
    const results = [];
    for (const subscription of subscriptions) {
      try {
        await calendarSubscriptionService.sync(state, subscription);
        results.push({ id: subscription.id, synced: true, error: "" });
      } catch (error) {
        results.push({ id: subscription.id, synced: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { subscriptions, imported: state.items.filter((item) => item.source === "ics").length, results };
  }),
  calendar_unsubscribe: async ({ id }) => await mutateCalendar((state) => {
    const subscriptionId = requireId(id);
    state.subscriptions = state.subscriptions.filter((entry) => entry.id !== subscriptionId);
    state.items = state.items.filter((item) => item.subscriptionId !== subscriptionId);
    return { deleted: true, id: subscriptionId };
  }),
};

async function mutateCalendar(callback) {
  const state = await readJson(files.calendar, { schemaVersion: 1, items: [], subscriptions: [] });
  const result = await callback(state);
  await writeJson(files.calendar, state);
  return result;
}

function assertEventRange(start, end, allDay) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (endTime < startTime || (!allDay && endTime === startTime)) {
    throw new Error("end must be after start");
  }
}

function toIso(value, field) {
  const date = new Date(requireText(value, field));
  if (!Number.isFinite(date.getTime())) throw new Error(`${field} must be a valid date`);
  return date.toISOString();
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(request) {
  if (request.method === "initialize") return { protocolVersion: request.params?.protocolVersion ?? "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "nextclaw-personal-organizer-data", version: "0.1.4" } };
  if (request.method === "ping") return {};
  if (request.method === "tools/list") return { tools };
  if (request.method === "tools/call") {
    const action = actions[request.params?.name];
    if (!action) throw new Error(`unknown tool: ${request.params?.name}`);
    const payload = await action(request.params?.arguments ?? {});
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  }
  throw new Error(`method not found: ${request.method}`);
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  if (!line.trim()) continue;
  let request;
  try {
    request = JSON.parse(line);
    if (request.id === undefined) continue;
    send({ jsonrpc: "2.0", id: request.id, result: await handle(request) });
  } catch (error) {
    if (request?.id !== undefined) send({ jsonrpc: "2.0", id: request.id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } });
  }
}
