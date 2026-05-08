import { SessionSearchDocumentBuilderService } from "../session-search-document-builder.service.js";
import type {
  SessionSearchFileScannerService,
  SessionSearchFileSummary,
} from "./session-search-file-scanner.service.js";
import type { SessionSearchStoreService } from "../session-search-store.service.js";
import type { SessionSearchIndexedMetadata } from "../session-search.types.js";
import type { SessionSearchWorkerProgress } from "./session-search-worker-protocol.types.js";

const YIELD_BATCH_SIZE = 25;

type SessionSearchWorkerIndexerOptions = {
  scanner: SessionSearchFileScannerService;
  store: SessionSearchStoreService;
  onProgress?: (progress: SessionSearchWorkerProgress) => void;
};

function toMetadataBySessionId(rows: SessionSearchIndexedMetadata[]): Map<string, SessionSearchIndexedMetadata> {
  return new Map(rows.map((row) => [row.sessionId, row]));
}

function shouldSkip(summary: SessionSearchFileSummary, metadata: SessionSearchIndexedMetadata | undefined): boolean {
  return Boolean(
    metadata &&
    metadata.updatedAt === summary.updatedAt &&
    metadata.contentHash === summary.contentHash,
  );
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

export class SessionSearchWorkerIndexerService {
  private readonly documentBuilder = new SessionSearchDocumentBuilderService();

  constructor(private readonly options: SessionSearchWorkerIndexerOptions) {}

  reconcileAll = async (): Promise<SessionSearchWorkerProgress> => {
    const summaries = await this.options.scanner.listSessionFiles();
    const existingMetadata = toMetadataBySessionId(await this.options.store.listIndexedMetadata());
    const activeSessionIds = new Set(summaries.map((summary) => summary.sessionId));
    const progress: SessionSearchWorkerProgress = {
      scanned: 0,
      indexed: 0,
      skipped: 0,
      deleted: 0,
      total: summaries.length,
    };

    for (const summary of summaries) {
      progress.scanned += 1;
      if (shouldSkip(summary, existingMetadata.get(summary.sessionId))) {
        progress.skipped += 1;
      } else {
        await this.indexSummary(summary);
        progress.indexed += 1;
      }
      this.options.onProgress?.({ ...progress });
      if (progress.scanned % YIELD_BATCH_SIZE === 0) {
        await yieldToEventLoop();
      }
    }

    for (const metadata of existingMetadata.values()) {
      if (activeSessionIds.has(metadata.sessionId)) {
        continue;
      }
      await this.options.store.deleteDocument(metadata.sessionId);
      progress.deleted += 1;
      this.options.onProgress?.({ ...progress });
    }

    return progress;
  };

  indexSession = async (sessionId: string): Promise<void> => {
    const summaries = await this.options.scanner.listSessionFiles();
    const summary = summaries.find((entry) => entry.sessionId === sessionId);
    if (!summary) {
      await this.options.store.deleteDocument(sessionId);
      return;
    }
    await this.indexSummary(summary);
  };

  private indexSummary = async (summary: SessionSearchFileSummary): Promise<void> => {
    const session = await this.options.scanner.readSession(summary);
    if (!session) {
      await this.options.store.deleteDocument(summary.sessionId);
      return;
    }
    const document = this.documentBuilder.buildDocument(session);
    if (!document) {
      await this.options.store.deleteDocument(summary.sessionId);
      return;
    }
    await this.options.store.upsertDocumentWithMetadata(document, {
      sessionId: summary.sessionId,
      updatedAt: summary.updatedAt,
      contentHash: summary.contentHash,
      indexedAt: new Date().toISOString(),
    });
  };
}
