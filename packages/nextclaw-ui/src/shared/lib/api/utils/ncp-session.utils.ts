import { nextclawClient } from "@/shared/lib/api/managers/client.manager";
import type {
  NcpSessionMessagesView,
  NcpSessionSkillsView,
  NcpSessionsListView,
  NcpSessionSummaryView,
  SessionPatchUpdate,
} from "@/shared/lib/api/types";

// GET /api/ncp/sessions
export async function fetchNcpSessions(params?: {
  limit?: number;
  peerId?: string;
}): Promise<NcpSessionsListView> {
  return (await nextclawClient.sessions.list(params)) as NcpSessionsListView;
}

// GET /api/ncp/sessions/:sessionId/messages
export async function fetchNcpSessionMessages(
  sessionId: string,
  options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
): Promise<NcpSessionMessagesView> {
  return (await nextclawClient.sessions.listMessages(
    sessionId,
    options,
  )) as NcpSessionMessagesView;
}

// GET /api/ncp/sessions/:sessionId/skills
export async function fetchNcpSessionSkills(
  sessionId: string,
  params?: { projectRoot?: string | null },
): Promise<NcpSessionSkillsView> {
  return await nextclawClient.sessions.listSkills(sessionId, params);
}

// PUT /api/ncp/sessions/:sessionId
export async function updateNcpSession(
  sessionId: string,
  data: SessionPatchUpdate,
): Promise<NcpSessionSummaryView> {
  return (await nextclawClient.sessions.update(
    sessionId,
    data,
  )) as NcpSessionSummaryView;
}

// POST /api/ncp/sessions/:sessionId/context/compact
export async function compactNcpSessionContext(
  sessionId: string,
): Promise<{ compacted: true; sessionId: string }> {
  return await nextclawClient.sessions.compactContext(sessionId);
}

// DELETE /api/ncp/sessions/:sessionId
export async function deleteNcpSession(
  sessionId: string,
): Promise<{ deleted: boolean; sessionId: string }> {
  return await nextclawClient.sessions.delete(sessionId);
}
