import type { NcpTool } from "@nextclaw/ncp";
import type { AgentSessionStore } from "@nextclaw/ncp-toolkit";
import { SessionSearchIndexManager } from "./session-search-index.manager.js";
import { SessionSearchQueryService } from "./session-search-query.service.js";
import { SessionSearchStoreService } from "./session-search-store.service.js";
import { SessionSearchTool } from "./session-search-tool.service.js";

type SessionSearchReadableStore = Pick<AgentSessionStore, "getSession" | "listSessions">;

export class SessionSearchFeatureService {
  private readonly store: SessionSearchStoreService;
  private readonly indexManager: SessionSearchIndexManager;
  private readonly queryService: SessionSearchQueryService;
  private pendingWork: Promise<void> = Promise.resolve();
  private initialized = false;
  private disposed = false;

  constructor(
    private readonly options: {
      sessionStore: SessionSearchReadableStore;
      databasePath: string;
    },
  ) {
    this.store = new SessionSearchStoreService(options.databasePath);
    this.indexManager = new SessionSearchIndexManager(this.store);
    this.queryService = new SessionSearchQueryService(this.store);
  }

  initialize = async (): Promise<void> => {
    if (this.initialized) {
      return;
    }
    if (this.disposed) {
      throw new Error("Session search feature has already been disposed.");
    }

    await this.store.initialize();
    await this.enqueue(async () => {
      const sessions = await this.options.sessionStore.listSessions();
      const activeSessionIds = new Set(sessions.map((session) => session.sessionId));
      for (const session of sessions) {
        await this.indexManager.indexSession(session);
      }

      const indexedSessionIds = await this.store.listIndexedSessionIds();
      for (const sessionId of indexedSessionIds) {
        if (!activeSessionIds.has(sessionId)) {
          await this.store.deleteDocument(sessionId);
        }
      }
    });
    this.initialized = true;
  };

  createTool = (params: { currentSessionId?: string }): NcpTool =>
    new SessionSearchTool(this.queryService, params);

  handleSessionUpdated = async (sessionId: string): Promise<void> => {
    if (this.disposed || !this.initialized) {
      return;
    }

    await this.enqueue(async () => {
      const session = await this.options.sessionStore.getSession(sessionId);
      if (!session) {
        await this.store.deleteDocument(sessionId);
        return;
      }
      await this.indexManager.indexSession(session);
    });
  };

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    await this.pendingWork;
    await this.store.close();
  };

  private enqueue(work: () => Promise<void>): Promise<void> {
    const next = this.pendingWork.then(work);
    this.pendingWork = next.catch(() => undefined);
    return next;
  }
}
