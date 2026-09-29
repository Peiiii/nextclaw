import { json, publicError } from "../bibo-auth.utils";
import { BiboEdgeSessionStore } from "../stores/bibo-edge-session.store";
import { applyBiboStorageChanges } from "../utils/bibo-storage.utils";
import type { BiboSession } from "../utils/bibo-session.utils";

type SessionStore = Pick<DurableObjectStorage, "get" | "put" | "transaction">;

async function deleteBiboSession(request: Request, storage: SessionStore, sessions: BiboSession[],
  mode: () => Promise<"legacy" | "edge">,
  deleteLegacy: (id: string, sessions: BiboSession[], request: Request) => Promise<Response>): Promise<Response> {
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string" || !sessions.some((item) => item.id === body.id)) return publicError("会话不存在。", 404);
  if (await mode() !== "edge") return deleteLegacy(body.id, sessions, request);
  const store = new BiboEdgeSessionStore(storage as DurableObjectStorage);
  const saved = await store.load(body.id);
  await storage.transaction(async (transaction) => {
    await applyBiboStorageChanges(transaction,
      { sessions: sessions.filter((item) => item.id !== body.id) }, store.prepareDelete(body.id as string, saved));
  });
  return json({ ok: true });
}

export async function biboSessionRoute(request: Request, url: URL, storage: SessionStore,
  mode: () => Promise<"legacy" | "edge">,
  deleteLegacy: (id: string, sessions: BiboSession[], request: Request) => Promise<Response>): Promise<Response> {
  const route = url.pathname;
  const sessions = await storage.get<BiboSession[]>("sessions") ?? [];
  if (route === "/sessions/delete" && request.method === "POST") return deleteBiboSession(request, storage, sessions, mode, deleteLegacy);
  if (route === "/sessions" && request.method === "GET") {
    return json({ sessions: sessions.map(({ messages, ...session }) => ({ ...session, messageCount: messages.length })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  }
  if (route === "/sessions/new" && request.method === "POST") {
    const time = new Date().toISOString();
    const session: BiboSession = { id: crypto.randomUUID(), title: "新对话", createdAt: time, updatedAt: time, messages: [] };
    await storage.put("sessions", [session, ...sessions]);
    return json({ session });
  }
  if (route === "/sessions/rename" && request.method === "POST") {
    const body = await request.json().catch(() => null) as { id?: unknown; title?: unknown } | null;
    if (!body || typeof body.id !== "string" || typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 100) return publicError("会话名称不正确。", 400);
    const session = sessions.find((item) => item.id === body.id);
    if (!session) return publicError("会话不存在。", 404);
    session.title = body.title.trim(); session.updatedAt = new Date().toISOString();
    await storage.put("sessions", sessions);
    return json({ session });
  }
  if (route === "/history") {
    const session = typeof url.searchParams.get("id") === "string" ? sessions.find((item) => item.id === url.searchParams.get("id")) : sessions[0];
    if (url.searchParams.has("id") && !session) return publicError("会话不存在或已删除。", 404);
    return json({ messages: session?.messages ?? [], session: session ? { id: session.id, title: session.title, updatedAt: session.updatedAt } : null });
  }
  return publicError("Not found", 404);
}

export async function resetBiboSessions(storage: DurableObjectStorage, snapshots: R2Bucket,
  id: string, stop: () => Promise<void>): Promise<Response> {
  await stop();
  const snapshotKey = await storage.get<string>("snapshotKey");
  if (snapshotKey) await snapshots.delete(snapshotKey);
  await snapshots.delete(id);
  await storage.deleteAll();
  return json({ ok: true });
}
