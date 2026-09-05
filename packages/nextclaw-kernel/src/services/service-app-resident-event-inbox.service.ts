import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ServiceAppResidentEventDisposition,
  ServiceAppResidentEventList,
  ServiceAppResidentEventStatus,
  ServiceAppResidentEventView,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import { ServiceAppError } from "@kernel/utils/service-app-error.utils.js";
import { PortableServiceRunnerError } from "@kernel/services/portable-service-runner-client.service.js";

const STORE_FILE_NAME = "service-resident-events.json";
const MAX_ATTEMPTS = 5;
const DEFAULT_LEASE_MS = 30_000;
const MAX_LEASE_MS = 5 * 60_000;
const MAX_RETRY_DELAY_MS = 60_000;

const STATUSES = new Set<ServiceAppResidentEventStatus>([
  "received", "pending", "leased", "acked", "retry-wait", "dead-letter",
]);

export type ServiceAppResidentEventScope = {
  appId: string;
  instanceId: string;
  stateDirectory: string;
};

export type ResidentEventInput = {
  eventId: string;
  streamKey?: string;
  payload: Record<string, unknown>;
  componentId?: string;
};

export type LeasedResidentEvent = ServiceAppResidentEventView & {
  payload: Record<string, unknown>;
};

export function normalizeResidentDisposition(raw: unknown): ServiceAppResidentEventDisposition {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { kind: "ack" };
  const candidate = raw as Record<string, unknown>;
  if (candidate.disposition === "ack") return { kind: "ack" };
  if (candidate.disposition === "retry") {
    const delayMs = typeof candidate.delayMs === "number" && Number.isFinite(candidate.delayMs) ? candidate.delayMs : undefined;
    const error = candidate.error && typeof candidate.error === "object" && !Array.isArray(candidate.error)
      ? candidate.error as { code?: unknown; message?: unknown } : undefined;
    return {
      kind: "retry", delayMs,
      error: typeof error?.message === "string"
        ? { code: typeof error.code === "string" ? error.code : undefined, message: error.message }
        : undefined,
    };
  }
  if ("disposition" in candidate) {
    throw new PortableServiceRunnerError("WASI_RESIDENT_DISPOSITION_INVALID", "Resident returned an invalid event disposition; expected ack or retry(delayMs).");
  }
  return { kind: "ack" };
}

export function requireResidentInboxScope(app: ServiceAppRecord): ServiceAppResidentEventScope {
  const stateDirectory = app.storage?.stateDirectory ?? app.dataDirectory;
  if (!stateDirectory) {
    throw new PortableServiceRunnerError("SERVICE_APP_RUNTIME_FAILED", `Resident ${app.id} is missing isolated instance state storage.`);
  }
  return { appId: app.packageId ?? app.id, instanceId: app.instanceId ?? app.id, stateDirectory };
}

type StoredEvent = ServiceAppResidentEventView & {
  payload: Record<string, unknown>;
};

type InboxStore = {
  schemaVersion: 1;
  frozen: boolean;
  cursors: Record<string, number>;
  events: StoredEvent[];
};

/**
 * Per installed-App-instance Resident delivery journal.  The host owns the
 * inbox and cursor; the Guest only receives a leased event and returns a
 * disposition.  This deliberately gives at-least-once delivery without
 * claiming that arbitrary Guest side effects are exactly-once.
 */
export class ServiceAppResidentEventInboxService {
  private readonly stores = new Map<string, InboxStore>();
  private readonly loadPromises = new Map<string, Promise<void>>();
  private readonly mutationQueues = new Map<string, Promise<unknown>>();

  enqueue = async (
    scope: ServiceAppResidentEventScope,
    input: ResidentEventInput,
  ): Promise<ServiceAppResidentEventView> => {
    this.assertEventInput(input);
    let event!: StoredEvent;
    await this.mutate(scope, (store) => {
      const existing = store.events.find((candidate) => candidate.eventId === input.eventId);
      if (existing) {
        event = existing;
        return false;
      }
      const now = new Date().toISOString();
      const streamKey = input.streamKey?.trim() || "default";
      if (store.events.some((candidate) => candidate.streamKey === streamKey && candidate.status === "dead-letter")) {
        throw new ServiceAppError("SERVICE_APP_RESIDENT_EVENT_CONFLICT", `Resident stream ${streamKey} is blocked by a dead-letter event.`);
      }
      const sequence = store.events
        .filter((candidate) => candidate.streamKey === streamKey)
        .reduce((maximum, candidate) => Math.max(maximum, candidate.sequence), 0) + 1;
      event = {
        id: randomUUID(),
        appId: scope.appId,
        instanceId: scope.instanceId,
        componentId: input.componentId ?? scope.appId,
        eventId: input.eventId,
        streamKey,
        sequence,
        status: "received",
        receivedAt: now,
        updatedAt: now,
        attempt: 0,
        payload: structuredClone(input.payload),
      };
      store.events.push(event);
    });
    // Persist the observable receive boundary before moving the event into the
    // eligible queue. This makes a crash between the two states recoverable.
    if (event.status === "received") {
      await this.mutate(scope, (store) => {
        const stored = this.requireEvent(store, event.id);
        if (stored.status === "received") this.transition(stored, "pending");
        event = stored;
      });
    }
    return this.toView(event);
  };

  list = async (
    scope: ServiceAppResidentEventScope,
    params: { status?: ServiceAppResidentEventStatus; deadLettersOnly?: boolean } = {},
  ): Promise<ServiceAppResidentEventList> => {
    await this.ensureLoaded(scope);
    const store = this.requireStore(scope);
    const expected = params.deadLettersOnly ? "dead-letter" : params.status;
    return {
      entries: store.events
        .filter((event) => !expected || event.status === expected)
        .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))
        .map((event) => this.toView(event)),
      cursors: { ...store.cursors },
      frozen: store.frozen,
    };
  };

  /** Reclaim expired leases then lease one item: one Resident means one lane. */
  leaseNext = async (
    scope: ServiceAppResidentEventScope,
    params: { leaseMs?: number; now?: Date } = {},
  ): Promise<LeasedResidentEvent | undefined> => {
    let leased: StoredEvent | undefined;
    const now = params.now ?? new Date();
    const leaseMs = this.clampLease(params.leaseMs ?? DEFAULT_LEASE_MS);
    await this.mutate(scope, (store) => {
      if (store.frozen) return false;
      const nowMs = now.getTime();
      let changed = false;
      for (const event of store.events) {
        if (event.status === "leased" && this.readTime(event.leaseExpiresAt) <= nowMs) {
          this.transition(event, "pending");
          event.leaseExpiresAt = undefined;
          changed = true;
        }
        if (event.status === "retry-wait" && this.readTime(event.nextAttemptAt) <= nowMs) {
          this.transition(event, "pending");
          event.nextAttemptAt = undefined;
          changed = true;
        }
      }
      // Do not let a later event overtake the earliest unacknowledged member
      // of a stream. The single Resident lane then makes the contract global
      // and preserves each individual stream's order.
      const streamHeads = new Map<string, StoredEvent>();
      for (const event of store.events) {
        if (event.status === "acked") continue;
        const current = streamHeads.get(event.streamKey);
        if (!current || event.sequence < current.sequence) streamHeads.set(event.streamKey, event);
      }
      let candidate: StoredEvent | undefined;
      for (const event of streamHeads.values()) {
        if (event.status === "pending" && (!candidate || event.receivedAt < candidate.receivedAt)) candidate = event;
      }
      if (!candidate) return changed;
      candidate.attempt += 1;
      this.transition(candidate, "leased");
      candidate.leaseExpiresAt = new Date(nowMs + leaseMs).toISOString();
      leased = candidate;
      return true;
    });
    return leased ? this.toLeased(leased) : undefined;
  };

  acknowledge = async (
    scope: ServiceAppResidentEventScope,
    eventId: string,
  ): Promise<ServiceAppResidentEventView> => {
    let updated!: StoredEvent;
    await this.mutate(scope, (store) => {
      const event = this.requireEventByEventId(store, eventId);
      this.assertLeased(event);
      this.transition(event, "acked");
      event.ackedAt = event.updatedAt;
      event.leaseExpiresAt = undefined;
      store.cursors[event.streamKey] = event.sequence;
      updated = event;
    });
    return this.toView(updated);
  };

  retry = async (
    scope: ServiceAppResidentEventScope,
    eventId: string,
    disposition: Extract<ServiceAppResidentEventDisposition, { kind: "retry" }>,
  ): Promise<ServiceAppResidentEventView> => {
    let updated!: StoredEvent;
    await this.mutate(scope, (store) => {
      const event = this.requireEventByEventId(store, eventId);
      this.assertLeased(event);
      event.leaseExpiresAt = undefined;
      event.lastError = disposition.error?.message
        ? { ...disposition.error, message: disposition.error.message.slice(0, 500) }
        : undefined;
      if (event.attempt >= MAX_ATTEMPTS) {
        this.transition(event, "dead-letter");
        event.deadLetteredAt = event.updatedAt;
      } else {
        this.transition(event, "retry-wait");
        const delay = this.retryDelay(event.attempt, disposition.delayMs);
        event.nextAttemptAt = new Date(Date.now() + delay).toISOString();
      }
      updated = event;
    });
    return this.toView(updated);
  };

  applyDisposition = async (
    scope: ServiceAppResidentEventScope,
    eventId: string,
    disposition: ServiceAppResidentEventDisposition,
  ): Promise<ServiceAppResidentEventView> => disposition.kind === "ack"
    ? await this.acknowledge(scope, eventId)
    : await this.retry(scope, eventId, disposition);

  replayDeadLetter = async (
    scope: ServiceAppResidentEventScope,
    eventId: string,
  ): Promise<ServiceAppResidentEventView> => {
    let updated!: StoredEvent;
    await this.mutate(scope, (store) => {
      const event = this.requireEventByEventId(store, eventId);
      if (event.status !== "dead-letter") {
        throw new ServiceAppError("SERVICE_APP_RESIDENT_EVENT_CONFLICT", `Resident event ${eventId} is not dead-lettered.`);
      }
      event.attempt = 0;
      event.deadLetteredAt = undefined;
      event.nextAttemptAt = undefined;
      event.leaseExpiresAt = undefined;
      this.transition(event, "pending");
      updated = event;
    });
    return this.toView(updated);
  };

  freeze = async (scope: ServiceAppResidentEventScope): Promise<void> => {
    await this.mutate(scope, (store) => { store.frozen = true; });
  };

  resume = async (scope: ServiceAppResidentEventScope): Promise<void> => {
    await this.mutate(scope, (store) => { store.frozen = false; });
  };

  private assertEventInput = (input: ResidentEventInput): void => {
    if (!input.eventId?.trim()) {
      throw new ServiceAppError("SERVICE_APP_RESIDENT_EVENT_CONFLICT", "Resident eventId is required.");
    }
    if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
      throw new ServiceAppError("SERVICE_APP_RESIDENT_EVENT_CONFLICT", "Resident event payload must be an object.");
    }
  };

  private retryDelay = (attempt: number, requested?: number): number => {
    const fallback = Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** Math.max(0, attempt - 1));
    return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, Number.isFinite(requested) ? requested! : fallback));
  };

  private clampLease = (leaseMs: number): number =>
    Math.min(MAX_LEASE_MS, Math.max(1, Number.isFinite(leaseMs) ? leaseMs : DEFAULT_LEASE_MS));

  private transition = (event: StoredEvent, next: ServiceAppResidentEventStatus): void => {
    event.status = next;
    event.updatedAt = new Date().toISOString();
  };

  private assertLeased = (event: StoredEvent): void => {
    if (event.status !== "leased") {
      throw new ServiceAppError("SERVICE_APP_RESIDENT_EVENT_LEASE_INVALID", `Resident event ${event.eventId} is not leased.`);
    }
  };

  private requireEvent = (store: InboxStore, id: string): StoredEvent => {
    const event = store.events.find((candidate) => candidate.id === id);
    if (!event) throw new ServiceAppError("SERVICE_APP_RESIDENT_EVENT_NOT_FOUND", `Resident event ${id} was not found.`);
    return event;
  };

  private requireEventByEventId = (store: InboxStore, eventId: string): StoredEvent => {
    const event = store.events.find((candidate) => candidate.eventId === eventId);
    if (!event) throw new ServiceAppError("SERVICE_APP_RESIDENT_EVENT_NOT_FOUND", `Resident event ${eventId} was not found.`);
    return event;
  };

  private toView = (event: StoredEvent): ServiceAppResidentEventView => {
    const { payload: _payload, lastError, ...view } = event;
    return { ...view, lastError: lastError ? { ...lastError } : undefined };
  };

  private toLeased = (event: StoredEvent): LeasedResidentEvent => ({
    ...this.toView(event), payload: structuredClone(event.payload),
  });

  private ensureLoaded = async (scope: ServiceAppResidentEventScope): Promise<void> => {
    const key = scope.stateDirectory;
    let loading = this.loadPromises.get(key);
    if (!loading) {
      loading = this.load(scope);
      this.loadPromises.set(key, loading);
    }
    await loading;
  };

  private load = async (scope: ServiceAppResidentEventScope): Promise<void> => {
    let store: InboxStore = { schemaVersion: 1, frozen: false, cursors: {}, events: [] };
    try {
      const parsed = JSON.parse(await readFile(this.storePath(scope), "utf8")) as unknown;
      if (this.isStore(parsed, scope)) store = parsed;
    } catch (error) {
      if (!this.isMissing(error)) throw error;
    }
    this.stores.set(scope.stateDirectory, store);
  };

  private mutate = async (scope: ServiceAppResidentEventScope, operation: (store: InboxStore) => boolean | void): Promise<void> => {
    await this.ensureLoaded(scope);
    const key = scope.stateDirectory;
    const next = (this.mutationQueues.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const changed = operation(this.requireStore(scope));
        if (changed !== false) await this.save(scope);
      });
    this.mutationQueues.set(key, next);
    await next;
  };

  private save = async (scope: ServiceAppResidentEventScope): Promise<void> => {
    const target = this.storePath(scope);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const staged = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(staged, `${JSON.stringify(this.requireStore(scope), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(staged, target);
    await chmod(target, 0o600);
  };

  private requireStore = (scope: ServiceAppResidentEventScope): InboxStore => {
    const store = this.stores.get(scope.stateDirectory);
    if (!store) throw new Error(`Resident event inbox ${scope.stateDirectory} was not loaded.`);
    return store;
  };

  private storePath = (scope: ServiceAppResidentEventScope): string => path.join(scope.stateDirectory, STORE_FILE_NAME);
  private readTime = (value: string | undefined): number => value ? Date.parse(value) : 0;
  private isMissing = (error: unknown): boolean => typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT";

  private isStore = (value: unknown, scope: ServiceAppResidentEventScope): value is InboxStore => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<InboxStore>;
    return candidate.schemaVersion === 1 && typeof candidate.frozen === "boolean" &&
      !!candidate.cursors && typeof candidate.cursors === "object" && Array.isArray(candidate.events) &&
      candidate.events.every((event) => this.isEvent(event, scope));
  };

  private isEvent = (value: unknown, scope: ServiceAppResidentEventScope): value is StoredEvent => {
    if (!value || typeof value !== "object") return false;
    const event = value as Partial<StoredEvent>;
    return typeof event.id === "string" && event.appId === scope.appId && event.instanceId === scope.instanceId &&
      typeof event.componentId === "string" && typeof event.eventId === "string" && typeof event.streamKey === "string" &&
      Number.isInteger(event.sequence) && (event.sequence ?? 0) > 0 && typeof event.status === "string" &&
      STATUSES.has(event.status as ServiceAppResidentEventStatus) && typeof event.receivedAt === "string" &&
      typeof event.updatedAt === "string" && Number.isInteger(event.attempt) && (event.attempt ?? -1) >= 0 &&
      !!event.payload && typeof event.payload === "object" && !Array.isArray(event.payload);
  };
}
