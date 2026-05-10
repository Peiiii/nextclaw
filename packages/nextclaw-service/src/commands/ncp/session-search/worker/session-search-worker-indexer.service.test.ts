import { SessionManager } from "@nextclaw/core";
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionSearchFileScannerService } from "./session-search-file-scanner.service.js";
import { SessionSearchQueryService } from "../session-search-query.service.js";
import { SessionSearchStoreService } from "../session-search-store.service.js";
import { SessionSearchWorkerIndexerService } from "./session-search-worker-indexer.service.js";

const tempDirs: string[] = [];
const activeStores: SessionSearchStoreService[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createTempHome(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-session-search-worker-"));
  const home = join(workspace, "home");
  mkdirSync(home, { recursive: true });
  process.env.NEXTCLAW_HOME = home;
  tempDirs.push(workspace);
  return home;
}

afterEach(async () => {
  while (activeStores.length > 0) {
    const store = activeStores.pop();
    if (store) {
      await store.close();
    }
  }
  if (originalNextclawHome) {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SessionSearchWorkerIndexerService", () => {
  it("indexes, skips unchanged files, updates changed sessions, and deletes stale rows", async () => {
    const home = createTempHome();
    const sessionManager = new SessionManager(join(home, "sessions"));
    const session = sessionManager.getOrCreate("release-session");
    session.metadata.label = "Release Review";
    sessionManager.addMessage(session, "user", "draft deploy checklist");
    sessionManager.addMessage(session, "assistant", "production rollout notes");
    sessionManager.save(session);

    const store = new SessionSearchStoreService(join(home, "session-search.db"));
    activeStores.push(store);
    await store.initialize();
    const indexer = new SessionSearchWorkerIndexerService({
      scanner: new SessionSearchFileScannerService(join(home, "sessions")),
      store,
    });
    const queryService = new SessionSearchQueryService(store);

    const firstProgress = await indexer.reconcileAll();
    expect(firstProgress).toMatchObject({ scanned: 1, indexed: 1, skipped: 0, deleted: 0 });
    await expect(queryService.search({ query: "deploy" })).resolves.toMatchObject({
      totalHits: 1,
      hits: [{ sessionId: "release-session", label: "Release Review" }],
    });

    const secondProgress = await indexer.reconcileAll();
    expect(secondProgress).toMatchObject({ scanned: 1, indexed: 0, skipped: 1, deleted: 0 });

    sessionManager.addMessage(session, "assistant", "rollback window confirmed");
    sessionManager.save(session);
    await indexer.indexSession("release-session");
    await expect(queryService.search({ query: "rollback" })).resolves.toMatchObject({
      totalHits: 1,
      hits: [{ sessionId: "release-session" }],
    });

    sessionManager.delete("release-session");
    await indexer.indexSession("release-session");
    await expect(queryService.search({ query: "deploy" })).resolves.toMatchObject({
      totalHits: 0,
      hits: [],
    });
  });
});
