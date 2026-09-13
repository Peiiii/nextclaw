import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AgentIdentity,
  Connection,
  ContextState,
} from "../types/collaboration.types.js";
import type { CollaborationStore } from "../stores/collaboration.store.js";
import { digest } from "./identity.utils.js";
import { OfficialSource } from "../services/official-source.service.js";
import { CodexConsumer } from "../services/codex-consumer.service.js";

export async function migrateDiscussion(
  store: CollaborationStore,
  legacyRoot: string,
  workspace: string,
  agent: AgentIdentity,
): Promise<{ imported: number; connectionId: string }> {
  const read = <T>(name: string): T =>
    JSON.parse(readFileSync(join(legacyRoot, name), "utf8")) as T;
  const runtime = existsSync(join(legacyRoot, "runtime.json"))
    ? read<{ pid: number }>("runtime.json")
    : undefined;
  assertLegacyStopped(runtime);
  const config = read<{
    endpoint: string;
    tokenFile: string;
    intervalMs: number;
  }>(
    existsSync(join(legacyRoot, "config.json"))
      ? "config.json"
      : "config.pre-collaboration.json",
  );
  const bindings = read<{
    discussions: Record<
      string,
      { threadId: string; eventIds: Record<string, string> }
    >;
  }>("discussion-bindings.json");
  const previous = store.get<{ connectionId: string }>("migration", legacyRoot);
  if (previous) {
    sealLegacyState(legacyRoot, store.path, previous.connectionId);
    return {
      imported: Object.keys(bindings.discussions).length,
      connectionId: previous.connectionId,
    };
  }
  const journal = read<{
    cursor: number;
    events: Record<string, { state: string }>;
  }>("journal.json");
  if (Object.values(journal.events).some((e) => e.state === "launching"))
    throw new Error(
      "Legacy journal has uncertain launching events; inspect before migration",
    );
  const consumer = new CodexConsumer(workspace);
  try {
    for (const binding of Object.values(bindings.discussions)) {
      const latest = Object.entries(binding.eventIds).at(-1);
      if (!latest) continue;
      const state = await consumer.inspect({
        threadId: binding.threadId,
        requestId: latest[0],
        turnId: latest[1],
      });
      if (state.state === "running" || state.state === "unknown")
        throw new Error(
          `Legacy task ${binding.threadId} is active or unresolved; finish it before migration`,
        );
    }
  } finally {
    await consumer.close();
  }
  const id = "official-discussions";
  if (store.get("connection", id))
    throw new Error(
      "Official connection already imported; do not migrate twice",
    );
  const connection: Connection = {
    id,
    adapter: "official",
    options: { endpoint: config.endpoint, tokenFile: config.tokenFile },
    agent,
    trustedAgents: [],
    allowedAccounts: ["*"],
    consumer: { kind: "codex", workspace },
    source: new URL(config.endpoint).origin,
    account: "nextclaw-discussion-participant",
    enabled: true,
    since: "1970-01-01T00:00:00Z",
    checkpoint: String(journal.cursor),
    intervalMs: config.intervalMs || 30_000,
    maxAgentHops: 4,
    maxRunsPerHour: 12,
  };
  await new OfficialSource(connection).check();
  // Disable the old configuration before the transaction: a crash cannot revive two listeners.
  retireLegacyConfig(legacyRoot);
  store.transaction(() => {
    store.put("connection", id, connection);
    for (const [subject, binding] of Object.entries(bindings.discussions)) {
      const key = digest(`${id}\0${subject}`);
      store.put("context", key, {
        key,
        connectionId: id,
        source: connection.source,
        subject,
        agentId: agent.id,
        title: subject,
        url: `${connection.source}/?discussion=${subject}`,
        threadId: binding.threadId,
        paused: false,
        status: "已迁移，等待原主题后续消息",
        statusPublished: "已迁移，等待原主题后续消息",
      } satisfies ContextState);
    }
    store.put("migration", legacyRoot, {
      importedAt: new Date().toISOString(),
      cursor: journal.cursor,
      connectionId: id,
    });
  });
  sealLegacyState(legacyRoot, store.path, id);
  return {
    imported: Object.keys(bindings.discussions).length,
    connectionId: id,
  };
}

function retireLegacyConfig(root: string): void {
  const original = join(root, "config.json");
  const backup = join(root, "config.pre-collaboration.json");
  if (!existsSync(original)) return;
  if (existsSync(backup))
    throw new Error(
      "Legacy config and migration backup both exist; inspect before replacing either",
    );
  renameSync(original, backup);
}
function sealLegacyState(
  legacyRoot: string,
  statePath: string,
  connectionId: string,
): void {
  retireLegacyConfig(legacyRoot);
  writeFileSync(
    join(legacyRoot, "collaboration-migration.json"),
    JSON.stringify({ statePath, connectionId }),
    { mode: 0o600 },
  );
}

function assertLegacyStopped(runtime: { pid: number } | undefined): void {
  if (runtime) {
    let alive = true;
    try {
      process.kill(runtime.pid, 0);
    } catch {
      alive = false;
    }
    if (alive)
      throw new Error(
        "Stop the existing discussion listener and finish its active Codex turns before migrating",
      );
  }
}
