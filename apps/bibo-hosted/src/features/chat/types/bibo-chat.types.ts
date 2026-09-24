export type BiboUser = { id: string; email: string };
export type BiboMessage = { role: "user" | "assistant"; text: string; at: string };
export type ChatEvent =
  | { name: "accepted"; value: { runId: string } }
  | { name: "delta"; value: { text: string } }
  | { name: "saving"; value: Record<string, never> }
  | { name: "committed"; value: { messages: BiboMessage[]; text: string } }
  | { name: "error"; value: { error: string } };
