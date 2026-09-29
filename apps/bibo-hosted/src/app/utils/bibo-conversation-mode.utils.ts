import type { BiboSession } from "./bibo-session.utils";

export async function readBiboConversationMode(storage: DurableObjectStorage, snapshots: R2Bucket,
  id: string): Promise<"legacy" | "edge"> {
  const mode = await storage.get<string>("conversationMode");
  if (mode === "edge") return "edge";
  if (mode) return "legacy";
  const sessions = await storage.get<BiboSession[]>("sessions") ?? [];
  if (sessions.some((session) => session.messages.length > 0) || await storage.get<string>("snapshotKey") ||
    await snapshots.head(id)) return "legacy";
  await storage.put("conversationMode", "edge");
  return "edge";
}
