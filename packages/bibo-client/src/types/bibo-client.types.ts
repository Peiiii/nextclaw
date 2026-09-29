export type BiboUser = { id: string; email: string };

export type BiboQuestion = {
  id: string;
  title: string;
  messageId: string;
  askedAt: string;
  status: "pending" | "answered" | "dismissed";
  options?: string[];
  recommendedOption?: string;
  optionDescriptions?: Record<string, string>;
  answer?: string;
};
export type BiboQuestionReference = { id: string; title: string; action: "answered" | "dismissed" };
export type BiboMessageContent = { type: "text"; text: string } | { type: "questions"; ids: string[] };
export type BiboMessage = { role: "user" | "assistant"; text: string; at: string; content?: BiboMessageContent[]; questions?: BiboQuestion[]; replyToQuestion?: BiboQuestionReference };
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
