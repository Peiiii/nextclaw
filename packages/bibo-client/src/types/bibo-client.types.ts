export type BiboUser = { id: string; email: string };

export type BiboMessage = { role: "user" | "assistant"; text: string; at: string };
export type BiboSession = { id: string; title: string; createdAt: string; updatedAt: string; messageCount?: number };

export type BiboShowContent = {
  id: string;
  sessionId: string;
  title?: string;
  target: { type: "file"; payload: { path: string; viewer?: "auto" | "source" | "rendered" } };
};
export type BiboUiEvent = { name: "show-content"; value: BiboShowContent };
export type BiboFileReadInput = { id: string; path?: never } | { path: string; id?: never };

export type BiboChatEvent =
  | BiboUiEvent
  | { name: "accepted"; value: { runId: string } }
  | { name: "delta"; value: { text: string } }
  | { name: "saving"; value: Record<string, never> }
  | { name: "committed"; value: { messages: BiboMessage[]; text: string; session: BiboSession | null } };

export type BiboClientOptions = { fetch?: typeof fetch };
