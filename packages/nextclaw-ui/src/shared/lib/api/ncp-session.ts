import { api } from './client';
import type {
  NcpSessionMessagesView,
  NcpSessionSkillsView,
  NcpSessionsListView,
  NcpSessionSummaryView,
  SessionPatchUpdate
} from './types';

// GET /api/ncp/sessions
export async function fetchNcpSessions(params?: { limit?: number }): Promise<NcpSessionsListView> {
  const query = new URLSearchParams();
  if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(Math.max(1, Math.trunc(params.limit))));
  }
  const suffix = query.toString();
  const response = await api.get<NcpSessionsListView>(suffix ? `/api/ncp/sessions?${suffix}` : '/api/ncp/sessions');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/ncp/sessions/:sessionId/messages
export async function fetchNcpSessionMessages(sessionId: string, limit = 200): Promise<NcpSessionMessagesView> {
  const response = await api.get<NcpSessionMessagesView>(
    `/api/ncp/sessions/${encodeURIComponent(sessionId)}/messages?limit=${Math.max(1, Math.trunc(limit))}`
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// GET /api/ncp/sessions/:sessionId/skills
export async function fetchNcpSessionSkills(
  sessionId: string,
  params?: { projectRoot?: string | null }
): Promise<NcpSessionSkillsView> {
  const query = new URLSearchParams();
  const projectRoot = params?.projectRoot?.trim();
  if (projectRoot) {
    query.set('projectRoot', projectRoot);
  }
  const suffix = query.toString();
  const response = await api.get<NcpSessionSkillsView>(
    suffix
      ? `/api/ncp/sessions/${encodeURIComponent(sessionId)}/skills?${suffix}`
      : `/api/ncp/sessions/${encodeURIComponent(sessionId)}/skills`
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// PUT /api/ncp/sessions/:sessionId
export async function updateNcpSession(
  sessionId: string,
  data: SessionPatchUpdate
): Promise<NcpSessionSummaryView> {
  const response = await api.put<NcpSessionSummaryView>(`/api/ncp/sessions/${encodeURIComponent(sessionId)}`, data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

// DELETE /api/ncp/sessions/:sessionId
export async function deleteNcpSession(sessionId: string): Promise<{ deleted: boolean; sessionId: string }> {
  const response = await api.delete<{ deleted: boolean; sessionId: string }>(
    `/api/ncp/sessions/${encodeURIComponent(sessionId)}`
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
