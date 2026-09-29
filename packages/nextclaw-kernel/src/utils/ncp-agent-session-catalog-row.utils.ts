import type { NcpSessionSummary } from "@nextclaw/ncp";

export type SessionCatalogRow = {
  session_id: string;
  peer_id: string | null;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  message_count: number;
  status: string;
  metadata_json: string;
  deleted_at: string | null;
};

export function summaryToRow(summary: NcpSessionSummary, deletedAt: string | null = null) {
  const updatedAt = summary.updatedAt || summary.createdAt || new Date().toISOString();
  return {
    session_id: summary.sessionId,
    peer_id: summary.peerId ?? null,
    agent_id: summary.agentId ?? null,
    created_at: summary.createdAt ?? updatedAt,
    updated_at: updatedAt,
    last_message_at: summary.lastMessageAt ?? null,
    message_count: Math.max(0, summary.messageCount ?? 0),
    status: summary.status || "idle",
    metadata_json: JSON.stringify(summary.metadata ?? {}),
    deleted_at: deletedAt,
  };
}

export function rowToSummary(row: SessionCatalogRow): NcpSessionSummary {
  const metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
  return {
    sessionId: row.session_id,
    ...(row.peer_id ? { peerId: row.peer_id } : {}),
    ...(row.agent_id ? { agentId: row.agent_id } : {}),
    messageCount: row.message_count,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    updatedAt: row.updated_at,
    ...(row.last_message_at ? { lastMessageAt: row.last_message_at } : {}),
    status: row.status as NcpSessionSummary["status"],
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}
