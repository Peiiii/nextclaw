export type BiboUser = { id: string; email: string };

export type BiboMessage = { role: "user" | "assistant"; text: string; at: string };

export type BiboChatEvent =
  | { name: "accepted"; value: { runId: string } }
  | { name: "delta"; value: { text: string } }
  | { name: "saving"; value: Record<string, never> }
  | { name: "committed"; value: { messages: BiboMessage[]; text: string } };

export type BiboClientOptions = { fetch?: typeof fetch };
