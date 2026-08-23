import { nextclawClient, requestApiResponse } from "@/shared/lib/api/managers/client.manager";
import type {
  NcpSessionMessagesView,
  NcpSessionTokenUsageView,
  NcpSessionSkillsView,
  NcpSessionsListView,
  NcpSessionSummaryView,
  SessionPatchUpdate,
  NcpSessionObservationAction,
  NcpSessionObservationKind,
  NcpSessionObservationsView,
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
  options: {
    limit?: number;
    cursor?: string;
    toolPayload?: "summary";
    initialPayload?: "compact";
    signal?: AbortSignal;
  } = {},
): Promise<NcpSessionMessagesView> {
  return (await nextclawClient.sessions.listMessages(
    sessionId,
    options,
  )) as NcpSessionMessagesView;
}

export async function fetchNcpSessionMessageDetail(
  sessionId: string,
  messageId: string,
  cursor: string,
  signal?: AbortSignal,
): Promise<NcpSessionMessagesView["messages"][number]> {
  const response = await fetchNcpSessionMessages(sessionId, {
    cursor,
    limit: 1,
    ...(signal ? { signal } : {}),
  });
  const message = response.messages[0];
  if (!message || message.id !== messageId) {
    throw new Error(`Session message detail no longer matches ${messageId}.`);
  }
  return message;
}

// GET /api/ncp/sessions/:sessionId/usage
export async function fetchNcpSessionTokenUsage(
  sessionId: string,
): Promise<NcpSessionTokenUsageView> {
  return (await nextclawClient.sessions.getUsage(sessionId)) as NcpSessionTokenUsageView;
}

// GET /api/ncp/sessions/:sessionId/observations
export async function fetchNcpSessionObservations(
  sessionId: string,
): Promise<NcpSessionObservationsView> {
  const response = await requestApiResponse<NcpSessionObservationsView>(
    `/api/ncp/sessions/${encodeURIComponent(sessionId)}/observations`,
  );
  if (!response.ok) throw new Error(response.error.message);
  return response.data;
}

// PATCH /api/ncp/sessions/:sessionId/observations/:kind/:id
export async function updateNcpSessionObservation(
  sessionId: string,
  input: {
    kind: NcpSessionObservationKind;
    id: string;
    action: NcpSessionObservationAction;
  },
): Promise<NcpSessionObservationsView> {
  const response = await requestApiResponse<NcpSessionObservationsView>(
    `/api/ncp/sessions/${encodeURIComponent(sessionId)}/observations/${input.kind}/${encodeURIComponent(input.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ action: input.action }),
    },
  );
  if (!response.ok) throw new Error(response.error.message);
  return response.data;
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
