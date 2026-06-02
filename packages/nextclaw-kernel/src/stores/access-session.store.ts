import type {
  AccessPrincipal,
  AccessSessionRecord,
  AccessSessionState,
} from "@kernel/types/access.types.js";
import { hashAccessSessionToken } from "@kernel/utils/access-token.utils.js";
import { existsSync, chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const ACCESS_SESSION_STATE_VERSION = 1;
const ACCESS_SESSION_STATE_KIND = "nextclaw.access.sessions";

function createEmptyState(): AccessSessionState {
  return {
    kind: ACCESS_SESSION_STATE_KIND,
    version: ACCESS_SESSION_STATE_VERSION,
    sessions: [],
  };
}

function isAccessPrincipal(value: unknown): value is AccessPrincipal {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as { id?: unknown; role?: unknown };
  return typeof record.id === "string" && record.id.trim().length > 0 && record.role === "admin";
}

function parseAccessSessionRecord(value: unknown): AccessSessionRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as {
    tokenHash?: unknown;
    principal?: unknown;
    createdAt?: unknown;
    expiresAt?: unknown;
  };
  if (
    typeof record.tokenHash !== "string" ||
    !record.tokenHash.trim() ||
    !isAccessPrincipal(record.principal) ||
    typeof record.createdAt !== "string" ||
    typeof record.expiresAt !== "string"
  ) {
    return null;
  }
  return {
    tokenHash: record.tokenHash,
    principal: record.principal,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

function parseAccessSessionState(value: unknown): AccessSessionState {
  if (!value || typeof value !== "object") {
    return createEmptyState();
  }
  const record = value as { version?: unknown; sessions?: unknown };
  if (
    (record as { kind?: unknown }).kind !== ACCESS_SESSION_STATE_KIND ||
    record.version !== ACCESS_SESSION_STATE_VERSION ||
    !Array.isArray(record.sessions)
  ) {
    return createEmptyState();
  }
  return {
    kind: ACCESS_SESSION_STATE_KIND,
    version: ACCESS_SESSION_STATE_VERSION,
    sessions: record.sessions
      .map(parseAccessSessionRecord)
      .filter((session): session is AccessSessionRecord => session !== null),
  };
}

function isSessionActive(session: AccessSessionRecord, nowMs: number): boolean {
  const expiresAtMs = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
}

export class AccessSessionStore {
  constructor(private readonly storePath: string) {}

  findPrincipalByToken = (token: string | null | undefined, now: Date): AccessPrincipal | null => {
    const normalizedToken = token?.trim();
    if (!normalizedToken) {
      return null;
    }
    const tokenHash = hashAccessSessionToken(normalizedToken);
    const nowMs = now.getTime();
    const session = this.readState().sessions.find(
      (entry) => entry.tokenHash === tokenHash && isSessionActive(entry, nowMs),
    );
    return session?.principal ?? null;
  };

  saveSession = (session: AccessSessionRecord, now: Date): void => {
    const activeSessions = this.readState().sessions.filter(
      (entry) => entry.tokenHash !== session.tokenHash && isSessionActive(entry, now.getTime()),
    );
    this.writeState({
      kind: ACCESS_SESSION_STATE_KIND,
      version: ACCESS_SESSION_STATE_VERSION,
      sessions: [...activeSessions, session],
    });
  };

  deleteToken = (token: string | null | undefined): void => {
    const normalizedToken = token?.trim();
    if (!normalizedToken) {
      return;
    }
    const tokenHash = hashAccessSessionToken(normalizedToken);
    this.writeState({
      kind: ACCESS_SESSION_STATE_KIND,
      version: ACCESS_SESSION_STATE_VERSION,
      sessions: this.readState().sessions.filter((session) => session.tokenHash !== tokenHash),
    });
  };

  clear = (): void => {
    this.writeState(createEmptyState());
  };

  private readState = (): AccessSessionState => {
    if (!existsSync(this.storePath)) {
      return createEmptyState();
    }
    try {
      return parseAccessSessionState(JSON.parse(readFileSync(this.storePath, "utf-8")));
    } catch {
      return createEmptyState();
    }
  };

  private writeState = (state: AccessSessionState): void => {
    mkdirSync(dirname(this.storePath), { recursive: true });
    const temporaryPath = `${this.storePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(state, null, 2), { mode: 0o600 });
    renameSync(temporaryPath, this.storePath);
    chmodSync(this.storePath, 0o600);
  };
}
