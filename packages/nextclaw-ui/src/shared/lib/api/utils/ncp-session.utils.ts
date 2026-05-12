import { nextclawClient } from '../managers/client.manager';
import type {
  NcpSessionMessagesView,
  NcpSessionSkillsView,
  NcpSessionsListView,
  NcpSessionSummaryView,
  SessionPatchUpdate
} from '@/shared/lib/api/types';

// GET /api/ncp/sessions
export async function fetchNcpSessions(params?: { limit?: number }): Promise<NcpSessionsListView> {
  return await nextclawClient.sessions.list(params) as NcpSessionsListView;
}

// GET /api/ncp/sessions/:sessionId/messages
export async function fetchNcpSessionMessages(sessionId: string, limit = 200): Promise<NcpSessionMessagesView> {
  return await nextclawClient.sessions.listMessages(sessionId, limit) as NcpSessionMessagesView;
}

// GET /api/ncp/sessions/:sessionId/skills
export async function fetchNcpSessionSkills(
  sessionId: string,
  params?: { projectRoot?: string | null }
): Promise<NcpSessionSkillsView> {
  return await nextclawClient.sessions.listSkills(sessionId, params);
}

// PUT /api/ncp/sessions/:sessionId
export async function updateNcpSession(
  sessionId: string,
  data: SessionPatchUpdate
): Promise<NcpSessionSummaryView> {
  return await nextclawClient.sessions.update(sessionId, data) as NcpSessionSummaryView;
}

// DELETE /api/ncp/sessions/:sessionId
export async function deleteNcpSession(sessionId: string): Promise<{ deleted: boolean; sessionId: string }> {
  return await nextclawClient.sessions.delete(sessionId);
}
