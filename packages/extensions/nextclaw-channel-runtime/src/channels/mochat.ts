import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import { io, type Socket } from "socket.io-client";
import { fetch } from "undici";
import { join } from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { getDataPath } from "../utils/helpers.js";

const MAX_SEEN_MESSAGE_IDS = 2000;
const CURSOR_SAVE_DEBOUNCE_MS = 500;

type MochatBufferedEntry = {
  rawBody: string;
  author: string;
  senderName: string;
  senderUsername: string;
  timestamp: number | null;
  messageId: string;
  groupId: string;
};

type DelayState = {
  entries: MochatBufferedEntry[];
  timer: NodeJS.Timeout | null;
  lock: AsyncLock;
};

type MochatTarget = {
  id: string;
  isPanel: boolean;
};

class AsyncLock {
  private queue = Promise.resolve();

  async run<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}

export class MochatChannel extends BaseChannel<Config["channels"]["mochat"]> {
  name = "mochat";

  private socket: Socket | null = null;
  private wsConnected = false;
  private wsReady = false;

  private stateDir = join(getDataPath(), "mochat");
  private cursorPath = join(this.stateDir, "session_cursors.json");
  private sessionCursor: Record<string, number> = {};
  private cursorSaveTimer: NodeJS.Timeout | null = null;

  private sessionSet = new Set<string>();
  private panelSet = new Set<string>();
  private autoDiscoverSessions = false;
  private autoDiscoverPanels = false;

  private coldSessions = new Set<string>();
  private sessionByConverse = new Map<string, string>();

  private seenSet = new Map<string, Set<string>>();
  private seenQueue = new Map<string, string[]>();
  private delayStates = new Map<string, DelayState>();

  private fallbackMode = false;
  private sessionFallbackTasks = new Map<string, Promise<void>>();
  private panelFallbackTasks = new Map<string, Promise<void>>();
  private refreshTimer: NodeJS.Timeout | null = null;
  private targetLocks = new Map<string, AsyncLock>();
  private refreshInFlight = false;

  constructor(config: Config["channels"]["mochat"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.clawToken) {
      throw new Error("Mochat clawToken not configured");
    }

    mkdirSync(this.stateDir, { recursive: true });
    await this.loadSessionCursors();
    this.seedTargetsFromConfig();
    await this.refreshTargets(false);

    const socketReady = await this.startSocketClient();
    if (!socketReady) {
      await this.ensureFallbackWorkers();
    }

    const intervalMs = Math.max(1000, this.config.refreshIntervalMs);
    this.refreshTimer = setInterval(() => {
      void this.refreshLoopTick();
    }, intervalMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    await this.stopFallbackWorkers();
    await this.cancelDelayTimers();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.cursorSaveTimer) {
      clearTimeout(this.cursorSaveTimer);
      this.cursorSaveTimer = null;
    }
    await this.saveSessionCursors();

    this.wsConnected = false;
    this.wsReady = false;
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.config.clawToken) {
      return;
    }

    const parts: string[] = [];
    if (msg.content && msg.content.trim()) {
      parts.push(msg.content.trim());
    }
    if (msg.media?.length) {
      for (const item of msg.media) {
        if (typeof item === "string" && item.trim()) {
          parts.push(item.trim());
        }
      }
    }

    const content = parts.join("\n").trim();
    if (!content) {
      return;
    }

    const target = resolveMochatTarget(msg.chatId);
    if (!target.id) {
      return;
    }

    const isPanel = (target.isPanel || this.panelSet.has(target.id)) && !target.id.startsWith("session_");
    if (isPanel) {
      await this.apiSend(
        "/api/claw/groups/panels/send",
        "panelId",
        target.id,
        content,
        msg.replyTo,
        readGroupId(msg.metadata ?? {})
      );
      return;
    }

    await this.apiSend("/api/claw/sessions/send", "sessionId", target.id, content, msg.replyTo);
  }

  private seedTargetsFromConfig(): void {
    const [sessions, autoSessions] = normalizeIdList(this.config.sessions);
    const [panels, autoPanels] = normalizeIdList(this.config.panels);
    this.autoDiscoverSessions = autoSessions;
    this.autoDiscoverPanels = autoPanels;

    sessions.forEach((sid) => {
      this.sessionSet.add(sid);
      if (!(sid in this.sessionCursor)) {
        this.coldSessions.add(sid);
      }
    });

    panels.forEach((pid) => {
      this.panelSet.add(pid);
    });
  }

  private async startSocketClient(): Promise<boolean> {
    let parser: unknown = undefined;
    if (!this.config.socketDisableMsgpack) {
      try {
        const mod = await import("socket.io-msgpack-parser");
        parser = mod.default ?? mod;
      } catch {
        parser = undefined;
      }
    }

    const socketUrl = (this.config.socketUrl || this.config.baseUrl).trim().replace(/\/$/, "");
    const socketPath = (this.config.socketPath || "/socket.io").trim();
    const reconnectionDelay = Math.max(100, this.config.socketReconnectDelayMs);
    const reconnectionDelayMax = Math.max(100, this.config.socketMaxReconnectDelayMs);
    const timeout = Math.max(1000, this.config.socketConnectTimeoutMs);
    const reconnectionAttempts =
      this.config.maxRetryAttempts > 0 ? this.config.maxRetryAttempts : Number.MAX_SAFE_INTEGER;

    const socket = io(socketUrl, {
      path: socketPath.startsWith("/") ? socketPath : `/${socketPath}`,
      transports: ["websocket"],
      auth: { token: this.config.clawToken },
      reconnection: true,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      timeout,
      parser: parser as never
    });

    socket.on("connect", async () => {
      this.wsConnected = true;
      this.wsReady = false;
      const subscribed = await this.subscribeAll();
      this.wsReady = subscribed;
      if (subscribed) {
        await this.stopFallbackWorkers();
      } else {
        await this.ensureFallbackWorkers();
      }
    });

    socket.on("disconnect", async () => {
      if (!this.running) {
        return;
      }
      this.wsConnected = false;
      this.wsReady = false;
      await this.ensureFallbackWorkers();
    });

    socket.on("connect_error", () => {
      this.wsConnected = false;
      this.wsReady = false;
    });

    socket.on("claw.session.events", async (payload: Record<string, unknown>) => {
      await this.handleWatchPayload(payload, "session");
    });

    socket.on("claw.panel.events", async (payload: Record<string, unknown>) => {
      await this.handleWatchPayload(payload, "panel");
    });

    const notifyHandler = (eventName: string) => async (payload: unknown) => {
      if (eventName === "notify:chat.inbox.append") {
        await this.handleNotifyInboxAppend(payload);
        return;
      }
      if (eventName.startsWith("notify:chat.message.")) {
        await this.handleNotifyChatMessage(payload);
      }
    };

    [
      "notify:chat.inbox.append",
      "notify:chat.message.add",
      "notify:chat.message.update",
      "notify:chat.message.recall",
      "notify:chat.message.delete"
    ].forEach((eventName) => {
      socket.on(eventName, notifyHandler(eventName));
    });

    this.socket = socket;

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout);
      socket.once("connect", () => {
        clearTimeout(timer);
        resolve(true);
      });
      socket.once("connect_error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  private async subscribeAll(): Promise<boolean> {
    const sessions = Array.from(this.sessionSet).sort();
    const panels = Array.from(this.panelSet).sort();
    let ok = await this.subscribeSessions(sessions);
    ok = (await this.subscribePanels(panels)) && ok;
    if (this.autoDiscoverSessions || this.autoDiscoverPanels) {
      await this.refreshTargets(true);
    }
    return ok;
  }

  private async subscribeSessions(sessionIds: string[]): Promise<boolean> {
    if (!sessionIds.length) {
      return true;
    }

    for (const sid of sessionIds) {
      if (!(sid in this.sessionCursor)) {
        this.coldSessions.add(sid);
      }
    }

    const ack = await this.socketCall("com.claw.im.subscribeSessions", {
      sessionIds,
      cursors: this.sessionCursor,
      limit: this.config.watchLimit
    });

    if (!ack.result) {
      return false;
    }

    const data = ack.data;
    let items: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
      items = data.filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[];
    } else if (data && typeof data === "object") {
      const sessions = (data as Record<string, unknown>).sessions;
      if (Array.isArray(sessions)) {
        items = sessions.filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[];
      } else if ((data as Record<string, unknown>).sessionId) {
        items = [data as Record<string, unknown>];
      }
    }

    for (const payload of items) {
      await this.handleWatchPayload(payload, "session");
    }

    return true;
  }

  private async subscribePanels(panelIds: string[]): Promise<boolean> {
    if (!this.autoDiscoverPanels && !panelIds.length) {
      return true;
    }

    const ack = await this.socketCall("com.claw.im.subscribePanels", { panelIds });
    if (!ack.result) {
      return false;
    }

    return true;
  }

  private async socketCall(eventName: string, payload: Record<string, unknown>): Promise<{ result: boolean; data?: unknown; message?: string }> {
    if (!this.socket) {
      return { result: false, message: "socket not connected" };
    }

    return new Promise((resolve) => {
      this.socket
        ?.timeout(10000)
        .emit(eventName, payload, (err: Error | null, response: unknown) => {
          if (err) {
            resolve({ result: false, message: String(err) });
            return;
          }
          if (response && typeof response === "object") {
            resolve(response as { result: boolean; data?: unknown; message?: string });
            return;
          }
          resolve({ result: true, data: response });
        });
    });
  }

  private async refreshLoopTick(): Promise<void> {
    if (!this.running || this.refreshInFlight) {
      return;
    }
    this.refreshInFlight = true;
    try {
      await this.refreshTargets(this.wsReady);
      if (this.fallbackMode) {
        await this.ensureFallbackWorkers();
      }
    } finally {
      this.refreshInFlight = false;
    }
  }

  private async refreshTargets(subscribeNew: boolean): Promise<void> {
    if (this.autoDiscoverSessions) {
      await this.refreshSessionsDirectory(subscribeNew);
    }
    if (this.autoDiscoverPanels) {
      await this.refreshPanels(subscribeNew);
    }
  }

  private async refreshSessionsDirectory(subscribeNew: boolean): Promise<void> {
    let response: Record<string, unknown>;
    try {
      response = await this.postJson("/api/claw/sessions/list", {});
    } catch {
      return;
    }

    const sessions = response.sessions as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(sessions)) {
      return;
    }

    const newIds: string[] = [];
    for (const session of sessions) {
      const sid = strField(session, "sessionId");
      if (!sid) {
        continue;
      }
      if (!this.sessionSet.has(sid)) {
        this.sessionSet.add(sid);
        newIds.push(sid);
        if (!(sid in this.sessionCursor)) {
          this.coldSessions.add(sid);
        }
      }
      const converseId = strField(session, "converseId");
      if (converseId) {
        this.sessionByConverse.set(converseId, sid);
      }
    }

    if (!newIds.length) {
      return;
    }
    if (this.wsReady && subscribeNew) {
      await this.subscribeSessions(newIds);
    }
    if (this.fallbackMode) {
      await this.ensureFallbackWorkers();
    }
  }

  private async refreshPanels(subscribeNew: boolean): Promise<void> {
    let response: Record<string, unknown>;
    try {
      response = await this.postJson("/api/claw/groups/get", {});
    } catch {
      return;
    }

    const panels = response.panels as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(panels)) {
      return;
    }

    const newIds: string[] = [];
    for (const panel of panels) {
      const panelType = panel.type as number | undefined;
      if (typeof panelType === "number" && panelType !== 0) {
        continue;
      }
      const pid = strField(panel, "id", "_id");
      if (pid && !this.panelSet.has(pid)) {
        this.panelSet.add(pid);
        newIds.push(pid);
      }
    }

    if (!newIds.length) {
      return;
    }
    if (this.wsReady && subscribeNew) {
      await this.subscribePanels(newIds);
    }
    if (this.fallbackMode) {
      await this.ensureFallbackWorkers();
    }
  }

  private async ensureFallbackWorkers(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.fallbackMode = true;

    for (const sid of this.sessionSet) {
      if (this.sessionFallbackTasks.has(sid)) {
        continue;
      }
      const task = this.sessionWatchWorker(sid).finally(() => {
        if (this.sessionFallbackTasks.get(sid) === task) {
          this.sessionFallbackTasks.delete(sid);
        }
      });
      this.sessionFallbackTasks.set(sid, task);
    }

    for (const pid of this.panelSet) {
      if (this.panelFallbackTasks.has(pid)) {
        continue;
      }
      const task = this.panelPollWorker(pid).finally(() => {
        if (this.panelFallbackTasks.get(pid) === task) {
          this.panelFallbackTasks.delete(pid);
        }
      });
      this.panelFallbackTasks.set(pid, task);
    }
  }

  private async stopFallbackWorkers(): Promise<void> {
    this.fallbackMode = false;
    const tasks = [...this.sessionFallbackTasks.values(), ...this.panelFallbackTasks.values()];
    this.sessionFallbackTasks.clear();
    this.panelFallbackTasks.clear();
    await Promise.allSettled(tasks);
  }

  private async sessionWatchWorker(sessionId: string): Promise<void> {
    while (this.running && this.fallbackMode) {
      try {
        const payload = await this.postJson("/api/claw/sessions/watch", {
          sessionId,
          cursor: this.sessionCursor[sessionId] ?? 0,
          timeoutMs: this.config.watchTimeoutMs,
          limit: this.config.watchLimit
        });
        await this.handleWatchPayload(payload, "session");
      } catch {
        await sleep(Math.max(100, this.config.retryDelayMs));
      }
    }
  }

  private async panelPollWorker(panelId: string): Promise<void> {
    const sleepMs = Math.max(1000, this.config.refreshIntervalMs);
    while (this.running && this.fallbackMode) {
      try {
        const payload = await this.postJson("/api/claw/groups/panels/messages", {
          panelId,
          limit: Math.min(100, Math.max(1, this.config.watchLimit))
        });
        const messages = payload.messages as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(messages)) {
          for (const msg of [...messages].reverse()) {
            const event = makeSyntheticEvent({
              messageId: String(msg.messageId ?? ""),
              author: String(msg.author ?? ""),
              content: msg.content,
              meta: msg.meta,
              groupId: String(payload.groupId ?? ""),
              converseId: panelId,
              timestamp: msg.createdAt,
              authorInfo: msg.authorInfo
            });
            await this.processInboundEvent(panelId, event, "panel");
          }
        }
      } catch {
        await sleep(sleepMs);
      }
      await sleep(sleepMs);
    }
  }

  private async handleWatchPayload(payload: Record<string, unknown>, targetKind: "session" | "panel"): Promise<void> {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const targetId = strField(payload, "sessionId");
    if (!targetId) {
      return;
    }

    const lockKey = `${targetKind}:${targetId}`;
    const lock = this.targetLocks.get(lockKey) ?? new AsyncLock();
    this.targetLocks.set(lockKey, lock);

    await lock.run(async () => {
      const previousCursor = this.sessionCursor[targetId] ?? 0;
      const cursor = payload.cursor;
      if (targetKind === "session" && typeof cursor === "number" && cursor >= 0) {
        this.markSessionCursor(targetId, cursor);
      }

      const rawEvents = payload.events as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(rawEvents)) {
        return;
      }

      if (targetKind === "session" && this.coldSessions.has(targetId)) {
        this.coldSessions.delete(targetId);
        return;
      }

      for (const event of rawEvents) {
        const seq = event.seq as number | undefined;
        if (targetKind === "session" && typeof seq === "number" && seq > (this.sessionCursor[targetId] ?? previousCursor)) {
          this.markSessionCursor(targetId, seq);
        }
        if (event.type === "message.add") {
          await this.processInboundEvent(targetId, event, targetKind);
        }
      }
    });
  }

  private async processInboundEvent(targetId: string, event: Record<string, unknown>, targetKind: "session" | "panel"): Promise<void> {
    const payload = event.payload as Record<string, unknown> | undefined;
    if (!payload) {
      return;
    }

    const author = strField(payload, "author");
    if (!author || (this.config.agentUserId && author === this.config.agentUserId)) {
      return;
    }
    if (!this.isAllowed(author)) {
      return;
    }

    const messageId = strField(payload, "messageId");
    const seenKey = `${targetKind}:${targetId}`;
    if (messageId && this.rememberMessageId(seenKey, messageId)) {
      return;
    }

    const rawBody = normalizeMochatContent(payload.content) || "[empty message]";
    const authorInfo = safeDict(payload.authorInfo);
    const senderName = strField(authorInfo, "nickname", "email");
    const senderUsername = strField(authorInfo, "agentId");
    const groupId = strField(payload, "groupId");
    const isGroup = Boolean(groupId);
    const wasMentioned = resolveWasMentioned(payload, this.config.agentUserId);
    const requireMention =
      targetKind === "panel" && isGroup && resolveRequireMention(this.config, targetId, groupId);
    const useDelay = targetKind === "panel" && this.config.replyDelayMode === "non-mention";

    if (requireMention && !wasMentioned && !useDelay) {
      return;
    }

    const entry: MochatBufferedEntry = {
      rawBody,
      author,
      senderName,
      senderUsername,
      timestamp: parseTimestamp(event.timestamp),
      messageId,
      groupId
    };

    if (useDelay) {
      const delayKey = seenKey;
      if (wasMentioned) {
        await this.flushDelayedEntries(delayKey, targetId, targetKind, true, entry);
      } else {
        await this.enqueueDelayedEntry(delayKey, targetId, targetKind, entry);
      }
      return;
    }

    await this.dispatchEntries(targetId, targetKind, [entry], wasMentioned);
  }

  private rememberMessageId(key: string, messageId: string): boolean {
    const seenSet = this.seenSet.get(key) ?? new Set<string>();
    const seenQueue = this.seenQueue.get(key) ?? [];
    if (seenSet.has(messageId)) {
      return true;
    }
    seenSet.add(messageId);
    seenQueue.push(messageId);
    while (seenQueue.length > MAX_SEEN_MESSAGE_IDS) {
      const removed = seenQueue.shift();
      if (removed) {
        seenSet.delete(removed);
      }
    }
    this.seenSet.set(key, seenSet);
    this.seenQueue.set(key, seenQueue);
    return false;
  }

  private async enqueueDelayedEntry(
    key: string,
    targetId: string,
    targetKind: "session" | "panel",
    entry: MochatBufferedEntry
  ): Promise<void> {
    const state = this.delayStates.get(key) ?? { entries: [], timer: null, lock: new AsyncLock() };
    this.delayStates.set(key, state);
    await state.lock.run(async () => {
      state.entries.push(entry);
      if (state.timer) {
        clearTimeout(state.timer);
      }
      state.timer = setTimeout(() => {
        void this.flushDelayedEntries(key, targetId, targetKind, false, null);
      }, Math.max(0, this.config.replyDelayMs));
    });
  }

  private async flushDelayedEntries(
    key: string,
    targetId: string,
    targetKind: "session" | "panel",
    mentioned: boolean,
    entry: MochatBufferedEntry | null
  ): Promise<void> {
    const state = this.delayStates.get(key) ?? { entries: [], timer: null, lock: new AsyncLock() };
    this.delayStates.set(key, state);
    let entries: MochatBufferedEntry[] = [];
    await state.lock.run(async () => {
      if (entry) {
        state.entries.push(entry);
      }
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      entries = [...state.entries];
      state.entries = [];
    });
    if (entries.length) {
      await this.dispatchEntries(targetId, targetKind, entries, mentioned);
    }
  }

  private async dispatchEntries(
    targetId: string,
    targetKind: "session" | "panel",
    entries: MochatBufferedEntry[],
    wasMentioned: boolean
  ): Promise<void> {
    const last = entries[entries.length - 1];
    const isGroup = Boolean(last.groupId);
    const body = buildBufferedBody(entries, isGroup) || "[empty message]";
    await this.handleMessage({
      senderId: last.author,
      chatId: targetId,
      content: body,
      attachments: [],
      metadata: {
        message_id: last.messageId,
        timestamp: last.timestamp,
        is_group: isGroup,
        group_id: last.groupId,
        sender_name: last.senderName,
        sender_username: last.senderUsername,
        target_kind: targetKind,
        was_mentioned: wasMentioned,
        buffered_count: entries.length
      }
    });
  }

  private async cancelDelayTimers(): Promise<void> {
    for (const state of this.delayStates.values()) {
      if (state.timer) {
        clearTimeout(state.timer);
      }
    }
    this.delayStates.clear();
  }

  private async handleNotifyChatMessage(payload: unknown): Promise<void> {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const data = payload as Record<string, unknown>;
    const groupId = strField(data, "groupId");
    const panelId = strField(data, "converseId", "panelId");
    if (!groupId || !panelId) {
      return;
    }
    if (this.panelSet.size && !this.panelSet.has(panelId)) {
      return;
    }

    const event = makeSyntheticEvent({
      messageId: String(data._id ?? data.messageId ?? ""),
      author: String(data.author ?? ""),
      content: data.content,
      meta: data.meta,
      groupId,
      converseId: panelId,
      timestamp: data.createdAt,
      authorInfo: data.authorInfo
    });

    await this.processInboundEvent(panelId, event, "panel");
  }

  private async handleNotifyInboxAppend(payload: unknown): Promise<void> {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const data = payload as Record<string, unknown>;
    if (data.type !== "message") {
      return;
    }
    const detail = data.payload as Record<string, unknown> | undefined;
    if (!detail || typeof detail !== "object") {
      return;
    }
    if (strField(detail, "groupId")) {
      return;
    }
    const converseId = strField(detail, "converseId");
    if (!converseId) {
      return;
    }

    let sessionId = this.sessionByConverse.get(converseId);
    if (!sessionId) {
      await this.refreshSessionsDirectory(this.wsReady);
      sessionId = this.sessionByConverse.get(converseId);
    }
    if (!sessionId) {
      return;
    }

    const event = makeSyntheticEvent({
      messageId: String(detail.messageId ?? data._id ?? ""),
      author: String(detail.messageAuthor ?? ""),
      content: String(detail.messagePlainContent ?? detail.messageSnippet ?? ""),
      meta: { source: "notify:chat.inbox.append", converseId },
      groupId: "",
      converseId,
      timestamp: data.createdAt
    });

    await this.processInboundEvent(sessionId, event, "session");
  }

  private markSessionCursor(sessionId: string, cursor: number): void {
    if (cursor < 0) {
      return;
    }
    const current = this.sessionCursor[sessionId] ?? 0;
    if (cursor < current) {
      return;
    }
    this.sessionCursor[sessionId] = cursor;
    if (!this.cursorSaveTimer) {
      this.cursorSaveTimer = setTimeout(() => {
        this.cursorSaveTimer = null;
        void this.saveSessionCursors();
      }, CURSOR_SAVE_DEBOUNCE_MS);
    }
  }

  private async loadSessionCursors(): Promise<void> {
    if (!existsSync(this.cursorPath)) {
      return;
    }
    try {
      const raw = readFileSync(this.cursorPath, "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      const cursors = data.cursors as Record<string, unknown> | undefined;
      if (cursors && typeof cursors === "object") {
        for (const [sid, value] of Object.entries(cursors)) {
          if (typeof value === "number" && value >= 0) {
            this.sessionCursor[sid] = value;
          }
        }
      }
    } catch {
      return;
    }
  }

  private async saveSessionCursors(): Promise<void> {
    try {
      mkdirSync(this.stateDir, { recursive: true });
      const payload = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        cursors: this.sessionCursor
      };
      writeFileSync(this.cursorPath, JSON.stringify(payload, null, 2) + "\n");
    } catch {
      return;
    }
  }

  private async postJson(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = `${this.config.baseUrl.trim().replace(/\/$/, "")}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Claw-Token": this.config.clawToken
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Mochat HTTP ${response.status}`);
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      parsed = await response.text();
    }

    if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).code !== undefined) {
      const data = parsed as Record<string, unknown>;
      if (typeof data.code === "number" && data.code !== 200) {
        throw new Error(String(data.message ?? data.name ?? "request failed"));
      }
      if (data.data && typeof data.data === "object") {
        return data.data as Record<string, unknown>;
      }
      return {};
    }

    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }

    return {};
  }

  private async apiSend(
    path: string,
    idKey: string,
    idValue: string,
    content: string,
    replyTo?: string | null,
    groupId?: string | null
  ): Promise<void> {
    const body: Record<string, unknown> = { [idKey]: idValue, content };
    if (replyTo) {
      body.replyTo = replyTo;
    }
    if (groupId) {
      body.groupId = groupId;
    }
    await this.postJson(path, body);
  }
}

function normalizeIdList(values: string[]): [string[], boolean] {
  const cleaned = values.map((value) => String(value).trim()).filter(Boolean);
  const unique = Array.from(new Set(cleaned.filter((value) => value !== "*"))).sort();
  return [unique, cleaned.includes("*")];
}

function safeDict(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function strField(src: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = src[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function makeSyntheticEvent(params: {
  messageId: string;
  author: string;
  content: unknown;
  meta?: unknown;
  groupId: string;
  converseId: string;
  timestamp?: unknown;
  authorInfo?: unknown;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    messageId: params.messageId,
    author: params.author,
    content: params.content,
    meta: safeDict(params.meta),
    groupId: params.groupId,
    converseId: params.converseId
  };
  if (params.authorInfo) {
    payload.authorInfo = safeDict(params.authorInfo);
  }
  return {
    type: "message.add",
    timestamp: params.timestamp ?? new Date().toISOString(),
    payload
  };
}

function normalizeMochatContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (content === null || content === undefined) {
    return "";
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function resolveMochatTarget(raw: string): MochatTarget {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return { id: "", isPanel: false };
  }

  const lowered = trimmed.toLowerCase();
  let cleaned = trimmed;
  let forcedPanel = false;
  for (const prefix of ["mochat:", "group:", "channel:", "panel:"]) {
    if (lowered.startsWith(prefix)) {
      cleaned = trimmed.slice(prefix.length).trim();
      forcedPanel = prefix !== "mochat:";
      break;
    }
  }

  if (!cleaned) {
    return { id: "", isPanel: false };
  }
  return { id: cleaned, isPanel: forcedPanel || !cleaned.startsWith("session_") };
}

function extractMentionIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      ids.push(item.trim());
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      for (const key of ["id", "userId", "_id"]) {
        const candidate = obj[key];
        if (typeof candidate === "string" && candidate.trim()) {
          ids.push(candidate.trim());
          break;
        }
      }
    }
  }
  return ids;
}

function resolveWasMentioned(payload: Record<string, unknown>, agentUserId: string): boolean {
  const meta = payload.meta as Record<string, unknown> | undefined;
  if (meta) {
    if (meta.mentioned === true || meta.wasMentioned === true) {
      return true;
    }
    for (const field of ["mentions", "mentionIds", "mentionedUserIds", "mentionedUsers"]) {
      if (agentUserId && extractMentionIds(meta[field]).includes(agentUserId)) {
        return true;
      }
    }
  }
  if (!agentUserId) {
    return false;
  }
  const content = payload.content;
  if (typeof content !== "string" || !content) {
    return false;
  }
  return content.includes(`<@${agentUserId}>`) || content.includes(`@${agentUserId}`);
}

function resolveRequireMention(config: Config["channels"]["mochat"], sessionId: string, groupId: string): boolean {
  const groups = config.groups ?? {};
  for (const key of [groupId, sessionId, "*"]) {
    if (key && groups[key]) {
      return Boolean(groups[key].requireMention);
    }
  }
  return Boolean(config.mention.requireInGroups);
}

function buildBufferedBody(entries: MochatBufferedEntry[], isGroup: boolean): string {
  if (!entries.length) {
    return "";
  }
  if (entries.length === 1) {
    return entries[0].rawBody;
  }
  const lines: string[] = [];
  for (const entry of entries) {
    if (!entry.rawBody) {
      continue;
    }
    if (isGroup) {
      const label = entry.senderName.trim() || entry.senderUsername.trim() || entry.author;
      if (label) {
        lines.push(`${label}: ${entry.rawBody}`);
        continue;
      }
    }
    lines.push(entry.rawBody);
  }
  return lines.join("\n").trim();
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function readGroupId(metadata: Record<string, unknown>): string | null {
  const value = (metadata.group_id as string | undefined) ?? (metadata.groupId as string | undefined);
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
