import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { safeFilename, getSessionsPath } from "../utils/helpers.js";

export type SessionMessage = {
  role: string;
  content: string;
  timestamp: string;
  [key: string]: unknown;
};

export type Session = {
  key: string;
  messages: SessionMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export class SessionManager {
  private sessionsDir: string;
  private cache: Map<string, Session> = new Map();

  constructor(private workspace: string) {
    this.sessionsDir = getSessionsPath();
  }

  private getSessionPath(key: string): string {
    const safeKey = safeFilename(key.replace(/:/g, "_"));
    return join(this.sessionsDir, `${safeKey}.jsonl`);
  }

  getOrCreate(key: string): Session {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const loaded = this.load(key);
    const session = loaded ?? {
      key,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };
    this.cache.set(key, session);
    return session;
  }

  getIfExists(key: string): Session | null {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const loaded = this.load(key);
    if (loaded) {
      this.cache.set(key, loaded);
    }
    return loaded;
  }

  addMessage(session: Session, role: string, content: string, extra: Record<string, unknown> = {}): void {
    const msg: SessionMessage = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...extra
    };
    session.messages.push(msg);
    session.updatedAt = new Date();
  }

  getHistory(session: Session, maxMessages = 50): Array<Record<string, string>> {
    const recent = session.messages.length > maxMessages ? session.messages.slice(-maxMessages) : session.messages;
    return recent.map((msg) => ({ role: msg.role, content: msg.content }));
  }

  clear(session: Session): void {
    session.messages = [];
    session.updatedAt = new Date();
  }

  private load(key: string): Session | null {
    const path = this.getSessionPath(key);
    if (!existsSync(path)) {
      return null;
    }
    try {
      const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean);
      const messages: SessionMessage[] = [];
      let metadata: Record<string, unknown> = {};
      let createdAt = new Date();
      let updatedAt = new Date();
      for (const line of lines) {
        const data = JSON.parse(line) as Record<string, unknown>;
        if (data._type === "metadata") {
          metadata = (data.metadata as Record<string, unknown>) ?? {};
          if (data.created_at) {
            createdAt = new Date(String(data.created_at));
          }
          if (data.updated_at) {
            updatedAt = new Date(String(data.updated_at));
          }
        } else {
          messages.push(data as SessionMessage);
        }
      }
      return {
        key,
        messages,
        createdAt,
        updatedAt,
        metadata
      };
    } catch {
      return null;
    }
  }

  save(session: Session): void {
    const path = this.getSessionPath(session.key);
    const metadataLine = {
      _type: "metadata",
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
      metadata: session.metadata
    };
    const lines = [JSON.stringify(metadataLine), ...session.messages.map((msg) => JSON.stringify(msg))].join("\n");
    writeFileSync(path, `${lines}\n`);
    this.cache.set(session.key, session);
  }

  delete(key: string): boolean {
    this.cache.delete(key);
    const path = this.getSessionPath(key);
    if (existsSync(path)) {
      unlinkSync(path);
      return true;
    }
    return false;
  }

  listSessions(): Array<Record<string, unknown>> {
    const sessions: Array<Record<string, unknown>> = [];
    for (const entry of readdirSync(this.sessionsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
        continue;
      }
      const path = join(this.sessionsDir, entry.name);
      const firstLine = readFileSync(path, "utf-8").split("\n")[0];
      if (!firstLine) {
        continue;
      }
      try {
        const data = JSON.parse(firstLine) as Record<string, unknown>;
        if (data._type === "metadata") {
          sessions.push({
            key: entry.name.replace(/\.jsonl$/, "").replace(/_/g, ":"),
            created_at: data.created_at,
            updated_at: data.updated_at,
            path,
            metadata: data.metadata ?? {}
          });
        }
      } catch {
        continue;
      }
    }
    return sessions;
  }
}
