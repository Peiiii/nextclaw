import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { SessionSearchDocumentBuilderService } from "./session-search-document-builder.service.js";
import type { SessionSearchStoreService } from "./session-search-store.service.js";

export class SessionSearchIndexManager {
  private readonly documentBuilder = new SessionSearchDocumentBuilderService();

  constructor(private readonly store: SessionSearchStoreService) {}

  indexSession = async (session: AgentSessionRecord): Promise<void> => {
    const document = this.documentBuilder.buildDocument(session);
    if (!document) {
      await this.store.deleteDocument(session.sessionId);
      return;
    }
    await this.store.upsertDocument(document);
  };
}
