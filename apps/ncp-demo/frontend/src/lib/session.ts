export type SessionSummary = {
  sessionId: string;
  messageCount: number;
  updatedAt: string;
  status?: "idle" | "running";
  activeRunId?: string;
};

const SESSION_STORAGE_KEY = "ncp-demo-session-id";

export function getOrCreateSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  const next = `demo-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

export async function refreshSessions(
  setter: (sessions: SessionSummary[]) => void,
): Promise<void> {
  const response = await fetch("/demo/sessions");
  if (!response.ok) {
    return;
  }
  const payload = (await response.json()) as SessionSummary[];
  setter(Array.isArray(payload) ? payload : []);
}
