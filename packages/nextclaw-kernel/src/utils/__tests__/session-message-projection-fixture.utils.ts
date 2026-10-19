import type { NcpMessage } from "@nextclaw/ncp";
import { openSqliteDatabase } from "@kernel/stores/sqlite-database.store.js";
import { join } from "node:path";

/** Compare message semantics while allowing a bounded descriptor to carry its source cursor. */
export function canonicalSessionMessages(messages: readonly NcpMessage[] | undefined): NcpMessage[] {
  return JSON.parse(JSON.stringify(messages?.map(message => {
    const metadata = { ...message.metadata }; delete metadata.nextclaw_source;
    return { ...message, metadata };
  }) ?? [])) as NcpMessage[];
}

export async function setProjectionVersion(directory: string, sessionId: string, version: number): Promise<void> {
  const database = await openSqliteDatabase(join(directory, ".message-projections", sessionId, "messages.sqlite"), { incremental: true });
  try {
    const row = database.prepare("SELECT value FROM projection_meta WHERE id=1").get() as { value: string };
    database.prepare("UPDATE projection_meta SET value=? WHERE id=1").run(JSON.stringify({ ...JSON.parse(row.value), version }));
  } finally { database.close(); }
}
