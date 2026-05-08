# Session Search Worker Indexing Implementation Plan

**Goal:** Move `session_search` indexing and querying out of the main Node.js event loop so NextClaw startup, `/api/health`, `/api/runtime/bootstrap-status`, UI, channels, and remote status remain responsive even with large historical session stores.

**Architecture:** `session_search` becomes a worker-owned capability. The main process owns only a lightweight `SessionSearchRuntimeSupport` controller and an async NCP tool facade; a dedicated worker thread owns session scanning, SQLite FTS access, incremental indexing, query execution, progress, and errors. Startup no longer runs session search initialization on the main thread, and the worker uses stale-while-revalidate indexing rather than rebuilding everything on every process start.

**Tech Stack:** Node.js `worker_threads`, TypeScript, existing `node:sqlite` FTS5 storage inside the worker only, existing NCP tool interfaces, Vitest, startup trace, NextClaw service smoke.

---

## Problem Statement

Current startup behavior is not acceptable:

- `Deferred startup` can print ready quickly, but `warm_ncp_capabilities` immediately starts `sessionSearchRuntimeSupport.initialize()`.
- `session_search` initialization walks all persisted sessions and indexes them into SQLite FTS.
- Session files are read through synchronous `readFileSync` and SQLite access uses `DatabaseSync`.
- On a large real home directory, this blocked the main Node event loop for about 12 seconds.
- During that block, `/api/health` was already listening but could not be served. A real probe measured the first `/api/health` request at `8.720779s`, then subsequent requests dropped to about `1ms`.

This violates the startup contract for NextClaw as a user-facing personal operation layer: the core entrypoint must become responsive first, while derived capabilities warm independently.

## Non-Goals

- Do not remove `session_search`.
- Do not add a user-facing switch for this migration.
- Do not keep two long-term implementations of session search.
- Do not introduce a second database technology.
- Do not block `NCP` runtime creation on search index readiness.
- Do not solve unrelated MCP server startup policy in this plan.

## Target Behavior

- Starting NextClaw must not run full session search indexing on the main thread.
- First `/api/health` request after UI API listen should remain fast, target `< 200ms` on the current large local home.
- `session_search` may be temporarily unavailable or stale while the worker starts, but the main app must stay responsive.
- Existing indexed data may be queried quickly once the worker opens the DB.
- Re-indexing must be incremental:
  - unchanged sessions are skipped,
  - changed sessions are re-indexed,
  - deleted sessions are removed from the index.
- Worker progress and errors must be observable from logs and runtime state.
- Shutdown must terminate the worker cleanly.

## Final Design

### Ownership

Main process:

- `SessionSearchRuntimeSupport`
- `SessionSearchWorkerController`
- `SessionSearchTool` facade
- readiness/progress state exposed to the NCP tool registry

Worker thread:

- session file discovery
- metadata comparison
- content extraction
- SQLite FTS schema migration
- incremental index writes
- query execution
- compaction/cleanup of deleted sessions

### Worker Protocol

Create a small protocol in:

- `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-worker-protocol.types.ts`

Message types:

```ts
export type SessionSearchWorkerRequest =
  | {
      id: string;
      type: "start";
      payload: {
        sessionsDir: string;
        databasePath: string;
      };
    }
  | {
      id: string;
      type: "query";
      payload: {
        query: string;
        limit?: number;
        includeCurrentSession?: boolean;
        currentSessionId?: string;
      };
    }
  | {
      id: string;
      type: "session-updated";
      payload: {
        sessionId: string;
      };
    }
  | {
      id: string;
      type: "dispose";
    };

export type SessionSearchWorkerEvent =
  | {
      type: "state";
      state: "starting" | "ready" | "indexing" | "idle" | "error" | "disposed";
      detail?: string;
    }
  | {
      type: "progress";
      scanned: number;
      indexed: number;
      skipped: number;
      deleted: number;
      total?: number;
    }
  | {
      type: "response";
      id: string;
      ok: true;
      result: unknown;
    }
  | {
      type: "response";
      id: string;
      ok: false;
      error: string;
    };
```

Keep the protocol intentionally small. Do not add subscription filtering, cancellation, or distributed worker orchestration in this batch.

### SQLite Schema

Keep the existing FTS table:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS session_search_index
USING fts5(
  session_id UNINDEXED,
  label,
  content,
  updated_at UNINDEXED,
  tokenize = 'unicode61'
);
```

Add metadata table:

```sql
CREATE TABLE IF NOT EXISTS session_search_meta (
  session_id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL
);
```

Incremental rule:

- Read session metadata first.
- If `session_id`, `updated_at`, and `content_hash` match `session_search_meta`, skip.
- If changed or missing, rebuild that one document.
- After scanning files, delete index/meta rows for sessions no longer present.

### Stale-While-Revalidate

Worker startup sequence:

1. Open SQLite DB in the worker.
2. Ensure schema.
3. Send `state: "ready"` as soon as query execution can use the existing index.
4. Start incremental reconciliation in worker background.
5. While indexing, queries use the current index.
6. When indexing finishes, send `state: "idle"`.

This avoids making search unavailable for the entire indexing window while still keeping main startup responsive.

### Main Thread Runtime Behavior

`SessionSearchRuntimeSupport.initialize()` should become lightweight:

- start the worker controller,
- send the `start` request,
- return after the worker has accepted startup, not after full indexing.

`createAdditionalTools()` can expose `session_search` when the worker is at least `ready`.

If the worker is not ready:

- return no `session_search` tool, preserving current behavior that tools are only exposed when ready.

`handleSessionUpdated(sessionKey)`:

- still calls `onSessionUpdated` synchronously for existing app behavior,
- sends `session-updated` to the worker if available,
- does not read or index session files on the main thread.

`dispose()`:

- sends `dispose`,
- terminates the worker if it does not exit promptly.

### Build And Dev Entry

Create worker entry:

- `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-worker-host.service.ts`

Create controller:

- `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-worker.controller.ts`

Worker resolution must support both dev and built package:

- in dev, use a tiny `tsx` bootstrap to load the `.ts` worker host, because worker threads do not reliably remap `.js` import specifiers to source `.ts` files,
- in dist, resolve the emitted `.js` worker host from the bundled app layout.

Update `packages/nextclaw/package.json` build script to include the worker entry as an additional `tsdown` entry:

```bash
tsdown src/index.ts src/cli/app/index.ts src/cli/launcher/index.ts src/cli/commands/ncp/session-search/worker/session-search-worker-host.service.ts --dts --clean --target es2022 --no-fixedExtension
```

This keeps release artifacts self-contained.

## Task 1: Capture The Regression With A Failing Startup Responsiveness Test

**Files:**

- Modify: `packages/nextclaw/src/cli/shared/services/gateway/tests/nextclaw-app.service.test.ts`
- Test support only if needed: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search-runtime.service.test.ts`

**Step 1: Add a test proving `NextclawApp.start()` does not call heavy warmup before returning**

Use the existing renamed gateway test. The test should assert:

- `app.start()` resolves,
- `warmDerivedCapabilities` has not completed before `app.start()` resolves,
- the scheduled warmup starts later.

**Step 2: Run the focused test**

Run:

```bash
pnpm --filter nextclaw test -- --run src/cli/shared/services/gateway/tests/nextclaw-app.service.test.ts
```

Expected before final implementation:

- Current timer-based behavior may pass this narrow test.
- Keep it as regression coverage, but do not treat it as sufficient.

**Step 3: Add a second test at `SessionSearchRuntimeSupport` level**

The test should use a fake worker controller whose `start()` resolves immediately while indexing remains pending.

Expected behavior:

- `initialize()` resolves without waiting for indexing.
- `createAdditionalTools()` returns no tool before worker ready.
- after controller emits ready, `createAdditionalTools()` returns one tool.

**Step 4: Run the session search runtime test**

Run:

```bash
pnpm --filter nextclaw test -- --run src/cli/commands/ncp/session-search/session-search-runtime.service.test.ts
```

Expected:

- New test fails before controller injection is implemented.

## Task 2: Introduce The Worker Protocol

**Files:**

- Create: `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-worker-protocol.types.ts`

**Step 1: Add request/event/result types**

Use the protocol from the design section.

**Step 2: Keep protocol type-only**

No runtime logic in this file.

**Step 3: Run TypeScript**

Run:

```bash
pnpm --filter nextclaw tsc
```

Expected:

- Pass.

## Task 3: Extract Worker-Safe Indexing Logic

**Files:**

- Create: `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-file-scanner.service.ts`
- Create: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search-document-builder.service.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search-index.manager.ts`
- Test: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search-feature.service.test.ts`

**Step 1: Move document construction out of `SessionSearchIndexManager`**

Create `SessionSearchDocumentBuilderService` with:

```ts
buildDocument(session: AgentSessionRecord): SessionSearchDocument | null
```

`SessionSearchIndexManager.indexSession()` should call this builder.

**Step 2: Add file scanner for worker**

`SessionSearchFileScannerService` should:

- read `*.jsonl` files from `sessionsDir`,
- parse the metadata first line,
- produce `{ sessionId, path, updatedAt, metadata }`,
- read full file only when the worker decides indexing is needed.

Use asynchronous `fs.promises` APIs.

**Step 3: Preserve current feature tests**

Run:

```bash
pnpm --filter nextclaw test -- --run src/cli/commands/ncp/session-search/session-search-feature.service.test.ts
```

Expected:

- Existing behavior remains unchanged.

## Task 4: Add Incremental SQLite Metadata

**Files:**

- Modify: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search-store.service.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search.types.ts`
- Test: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search-feature.service.test.ts`

**Step 1: Add metadata table creation**

Extend `initialize()` to create `session_search_meta`.

**Step 2: Add metadata methods**

Add:

```ts
getIndexedMetadata(sessionId: string): Promise<SessionSearchIndexedMetadata | null>
upsertDocumentWithMetadata(document: SessionSearchDocument, metadata: SessionSearchIndexedMetadata): Promise<void>
listIndexedMetadata(): Promise<SessionSearchIndexedMetadata[]>
deleteDocument(sessionId: string): Promise<void>
```

`deleteDocument()` must delete both FTS row and metadata row.

**Step 3: Keep query behavior identical**

`searchDocuments()` result shape must not change.

**Step 4: Test metadata skip behavior**

Add a test proving unchanged sessions are not re-upserted when metadata matches. If direct spying on SQLite statements is awkward, test through a fake store at the worker indexer layer in Task 5 instead.

## Task 5: Implement Worker Indexer Service

**Files:**

- Create: `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-worker-indexer.service.ts`
- Test: `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-worker-indexer.service.test.ts`

**Step 1: Write failing test for incremental indexing**

Set up temp sessions:

- session A unchanged,
- session B changed,
- session C deleted from disk but present in meta.

Expected:

- A skipped,
- B indexed,
- C deleted.

**Step 2: Implement `SessionSearchWorkerIndexerService`**

Responsibilities:

- scan metadata,
- compare with SQLite metadata,
- read full changed sessions,
- build documents,
- write updates,
- delete missing rows,
- emit progress.

**Step 3: Batch and yield**

After every small batch, await a worker-local yield:

```ts
await new Promise((resolve) => setImmediate(resolve));
```

This keeps the worker responsive to query messages.

**Step 4: Run worker indexer tests**

Run:

```bash
pnpm --filter nextclaw test -- --run src/cli/commands/ncp/session-search/worker/session-search-worker-indexer.service.test.ts
```

Expected:

- Pass.

## Task 6: Implement Worker Entry

**Files:**

- Create: `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-worker-host.service.ts`
- Test indirectly through controller tests.

**Step 1: Wire protocol handling**

The worker should:

- create `SessionSearchStoreService`,
- create `SessionSearchQueryService`,
- create `SessionSearchWorkerIndexerService`,
- respond to `start`, `query`, `session-updated`, `dispose`.

**Step 2: `start` behavior**

On `start`:

- initialize SQLite,
- emit `state: "ready"`,
- start incremental index,
- emit progress,
- emit `state: "idle"` when done.

**Step 3: `query` behavior**

On `query`:

- call `SessionSearchQueryService.search()`,
- return existing `SessionSearchResult` shape.

**Step 4: Error handling**

All request handlers return `response` with `ok: false` on failure. Worker-level fatal errors emit `state: "error"`.

## Task 7: Implement Main Worker Controller

**Files:**

- Create: `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-worker.controller.ts`
- Test: `packages/nextclaw/src/cli/commands/ncp/session-search/worker/session-search-worker.controller.test.ts`

**Step 1: Add controller state**

State:

```ts
type SessionSearchWorkerState =
  | "stopped"
  | "starting"
  | "ready"
  | "indexing"
  | "idle"
  | "error";
```

**Step 2: Add RPC request map**

Map `id -> resolve/reject` for worker responses.

**Step 3: Add worker entry resolution**

Use the worker host service in dev and built output:

```ts
const entry = new URL(
  import.meta.url.endsWith(".ts")
    ? "./session-search-worker-host.service.ts"
    : "./session-search-worker-host.service.js",
  import.meta.url,
);
```

When using the `.ts` host, route through the small `tsx` bootstrap described above so source `.js` import specifiers resolve correctly.

**Step 4: Add public methods**

```ts
start(params: { sessionsDir: string; databasePath: string }): Promise<void>
query(request: SessionSearchRequest): Promise<SessionSearchResult>
notifySessionUpdated(sessionId: string): void
dispose(): Promise<void>
getState(): SessionSearchWorkerState
```

**Step 5: Test controller**

Use a fake worker adapter if direct worker tests are too brittle. The controller must be tested for:

- request/response correlation,
- state updates,
- query rejection on worker error,
- dispose termination.

## Task 8: Replace `SessionSearchRuntimeSupport` Initialization

**Files:**

- Modify: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search-runtime.service.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search-tool.service.ts`
- Test: `packages/nextclaw/src/cli/commands/ncp/session-search/session-search-runtime.service.test.ts`

**Step 1: Change constructor dependencies**

Allow injection of worker controller for tests.

Production constructor creates:

```ts
new SessionSearchWorkerController()
```

**Step 2: Make `initialize()` lightweight**

It should:

- start the worker,
- return when the worker accepts startup,
- not wait for full indexing.

**Step 3: Replace `SessionSearchTool` query dependency**

Either:

- change `SessionSearchTool` to accept a `search(request)` interface, or
- create a small `SessionSearchWorkerQueryService`.

Prefer the interface to avoid another unnecessary class:

```ts
type SessionSearchQueryExecutor = {
  search: (request: SessionSearchRequest) => Promise<SessionSearchResult>;
};
```

**Step 4: Update readiness**

`createAdditionalTools()` exposes `session_search` only when worker state is `ready`, `indexing`, or `idle`.

**Step 5: Update tests**

Run:

```bash
pnpm --filter nextclaw test -- --run src/cli/commands/ncp/session-search/session-search-runtime.service.test.ts
```

Expected:

- Pass.

## Task 9: Remove Main-Thread Full Indexing From Startup

**Files:**

- Modify: `packages/nextclaw/src/cli/commands/ncp/features/runtime/create-ui-ncp-agent.service.ts`
- Modify: `packages/nextclaw/src/cli/shared/services/gateway/nextclaw-app.service.ts`
- Test: `packages/nextclaw/src/cli/shared/services/gateway/tests/nextclaw-app.service.test.ts`

**Step 1: Keep MCP warmup separate**

Change `runDerivedCapabilityWarmup()` so session search initialization is no longer bundled with MCP in a single `Promise.all` that can hide different costs.

Target shape:

```ts
private runDerivedCapabilityWarmup = async (): Promise<void> => {
  await this.sessionSearchRuntimeSupport.initialize();
  const mcpWarmResults = await this.mcpRuntimeSupport.prewarmEnabledServers();
  ...
};
```

This is acceptable only after `SessionSearchRuntimeSupport.initialize()` has become worker-start-only and does not index in the main thread.

**Step 2: Keep `NextclawApp` warmup post-ready**

Current post-ready timer is acceptable after workerization because session search no longer blocks the main thread. Do not add another arbitrary grace delay.

**Step 3: Run tests**

Run:

```bash
pnpm --filter nextclaw test -- --run src/cli/shared/services/gateway/tests/nextclaw-app.service.test.ts
```

Expected:

- Pass.

## Task 10: Build Packaging Support

**Files:**

- Modify: `packages/nextclaw/package.json`

**Step 1: Add worker entry to build**

Update `build` script as described in the build section.

**Step 2: Run build**

Run:

```bash
pnpm -C packages/nextclaw build
```

Expected:

- `dist/cli/commands/ncp/session-search/worker/session-search-worker-host.service.js` exists.

**Step 3: Run packaged smoke if build passes**

Run:

```bash
pnpm -C packages/nextclaw start serve --ui-port 18895
```

In another shell:

```bash
curl -sS -o /dev/null -w 'code=%{http_code} total=%{time_total}\n' http://127.0.0.1:18895/api/health
```

Expected:

- first health request remains fast,
- no worker entry missing error.

## Task 11: Startup Responsiveness Smoke

**Files:**

- No new files required.

**Step 1: Run dev startup with trace**

Run:

```bash
NEXTCLAW_STARTUP_TRACE=1 pnpm -C packages/nextclaw dev:build serve --ui-port 18894
```

**Step 2: Probe health repeatedly**

Run:

```bash
for i in $(seq 1 20); do
  printf '%s ' "$(date +%H:%M:%S)"
  curl -sS -o /dev/null -w 'code=%{http_code} total=%{time_total}\n' http://127.0.0.1:18894/api/health || true
  sleep 1
done
```

Expected:

- first successful `/api/health` request should be below `200ms` on the existing large local home,
- no multi-second stall while `session_search` indexes,
- worker progress logs may continue after health is responsive.

**Step 3: Verify `session_search` behavior**

Start a session after the worker reports ready and confirm `session_search` appears in available tools. Before ready, confirm it is absent rather than blocking runtime startup.

## Task 12: Validation And Maintainability Closure

**Files:**

- Update iteration log only if implementation touches code.

**Step 1: Run focused tests**

Run:

```bash
pnpm --filter nextclaw test -- --run \
  src/cli/commands/ncp/session-search/session-search-runtime.service.test.ts \
  src/cli/commands/ncp/session-search/session-search-feature.service.test.ts \
  src/cli/commands/ncp/session-search/worker/session-search-worker-indexer.service.test.ts \
  src/cli/shared/services/gateway/tests/nextclaw-app.service.test.ts
```

**Step 2: Run TypeScript**

Run:

```bash
pnpm --filter nextclaw tsc
```

**Step 3: Run build**

Run:

```bash
pnpm -C packages/nextclaw build
```

**Step 4: Run startup smoke**

Use Task 11.

**Step 5: Run maintainability checks**

Run targeted guard first:

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched-files>
```

Run governance:

```bash
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
```

Known current risk:

- `packages/nextclaw-openclaw-compat/src/plugins/bundled-channel-plugin-packages.constants.ts` is already touched in the current working tree and may still fail file-role-boundary governance until that separate temporary channel-disable change is cleaned up or renamed.

**Step 6: Update iteration log**

Because implementation will touch runtime code, update or create `docs/logs/v0.18.16-startup-ready-unblock/README.md` with:

- final root cause,
- worker solution summary,
- startup smoke numbers,
- build result,
- maintainability summary,
- NPM release status.

## Acceptance Criteria

- Main process never performs full session search indexing during startup.
- `node:sqlite` usage for session search is isolated to the worker.
- First health probe after service listen does not wait for session indexing.
- `session_search` remains available once worker is ready.
- Indexing is incremental and skips unchanged sessions.
- Deleted sessions are cleaned from the FTS index.
- Worker errors do not crash the main service.
- Worker is terminated on runtime disposal.
- Dev mode and built package both locate the worker entry.
- Focused tests, `tsc`, build, startup smoke, and maintainability checks are completed.

## Implementation Notes

- Do not use `setTimeout(5000)` or another grace delay as the fix. Delaying the problem is not the architecture.
- Do not run `SessionManager.getIfExists()` for every historical session on the main thread.
- Do not pass full session contents from main to worker. Pass paths/config; worker reads files itself.
- Do not expose partial worker internals through the NCP tool registry.
- Keep `session_search` as a derived capability. It is useful, but it must never define whether NextClaw is started.
- Do not commit unless the user explicitly asks.
