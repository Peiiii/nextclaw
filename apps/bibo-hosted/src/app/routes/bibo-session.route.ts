import { json, publicError } from "../bibo-auth.utils";
import { CloudflareSessionStore } from "../stores/cloudflare-session.store";
import { applyBiboStorageChanges } from "../utils/bibo-storage.utils";
import type { BiboSession } from "../utils/bibo-session.utils";
import { projectBiboConversation } from "../utils/bibo-session.utils";

type SessionStore = Pick<DurableObjectStorage, "get" | "put" | "list" | "transaction">;

async function deleteBiboSession(request: Request, storage: SessionStore, sessions: BiboSession[]): Promise<Response> {
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string") return publicError("会话不存在。", 404);
  const store = new CloudflareSessionStore(storage as DurableObjectStorage);
  if (!sessions.some((item) => item.id === body.id) && !await store.getSessionSummary(body.id)) return publicError("会话不存在。", 404);
  const deletedKeys = await store.prepareDelete(body.id);
  await storage.transaction(async (transaction) => {
    await applyBiboStorageChanges(transaction,
      { sessions: sessions.filter((item) => item.id !== body.id) }, deletedKeys);
  });
  return json({ ok: true });
}

async function listBiboSessions(storage: SessionStore, sessions: BiboSession[]): Promise<Response> {
    const summaries = await new CloudflareSessionStore(storage as DurableObjectStorage).listSessionSummaries();
    const rows = new Map(sessions.map(({ messages, ...session }) => [session.id, { ...session, messageCount: messages.length }]));
    for (const summary of summaries) {
      const previous = rows.get(summary.sessionId);
      rows.set(summary.sessionId, { id: summary.sessionId, title: String(summary.metadata?.label ?? previous?.title ?? "新对话"),
        createdAt: summary.createdAt ?? summary.updatedAt, updatedAt: summary.updatedAt, messageCount: summary.messageCount });
    }
    return json({ sessions: [...rows.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
}

async function renameBiboSession(request: Request, storage: SessionStore, sessions: BiboSession[]): Promise<Response> {
    const body = await request.json().catch(() => null) as { id?: unknown; title?: unknown } | null;
    if (!body || typeof body.id !== "string" || typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 100) return publicError("会话名称不正确。", 400);
    let session = sessions.find((item) => item.id === body.id);
    const store = new CloudflareSessionStore(storage as DurableObjectStorage);
    const summary = await store.getSessionSummary(body.id);
    if (!session && summary) session = { id: summary.sessionId, title: String(summary.metadata?.label ?? "新对话"),
      createdAt: summary.createdAt ?? summary.updatedAt, updatedAt: summary.updatedAt, messages: [] };
    if (!session) return publicError("会话不存在。", 404);
    session.title = body.title.trim(); session.updatedAt = new Date().toISOString();
    await store.updateSessionMetadata({
      sessionId: session.id, metadata: { label: session.title, label_source: "manual" },
    });
    await storage.put("sessions", sessions);
    return json({ session });
}

async function readBiboHistory(url: URL, storage: SessionStore, sessions: BiboSession[]): Promise<Response> {
    const session = typeof url.searchParams.get("id") === "string" ? sessions.find((item) => item.id === url.searchParams.get("id")) : sessions[0];
    const id = url.searchParams.get("id") ?? session?.id;
    const canonical = id ? await new CloudflareSessionStore(storage as DurableObjectStorage).getSession(id) : null;
    if (url.searchParams.has("id") && !session && !canonical) return publicError("会话不存在或已删除。", 404);
    return json({ messages: canonical ? projectBiboConversation(canonical.messages) : session?.messages ?? [],
      session: id && (canonical || session) ? { id, title: String(canonical?.metadata?.label ?? session?.title ?? "新对话"),
        updatedAt: canonical?.updatedAt ?? session!.updatedAt } : null });
}

export async function biboSessionRoute(request: Request, url: URL, storage: SessionStore): Promise<Response> {
  const route = url.pathname;
  const sessions = await storage.get<BiboSession[]>("sessions") ?? [];
  if (route === "/sessions/delete" && request.method === "POST") return deleteBiboSession(request, storage, sessions);
  if (route === "/sessions" && request.method === "GET") return listBiboSessions(storage, sessions);
  if (route === "/sessions/rename" && request.method === "POST") return renameBiboSession(request, storage, sessions);
  if (route === "/history") return readBiboHistory(url, storage, sessions);
  if (route === "/sessions/new" && request.method === "POST") {
    const time = new Date().toISOString();
    const session: BiboSession = { id: crypto.randomUUID(), title: "新对话", createdAt: time, updatedAt: time, messages: [] };
    await storage.put("sessions", [session, ...sessions]);
    return json({ session });
  }
  return publicError("Not found", 404);
}

export async function resetBiboSessions(storage: DurableObjectStorage, snapshots: R2Bucket,
  id: string): Promise<Response> {
  let cursor: string | undefined;
  do {
    const page = await snapshots.list({ prefix: `${id}/workspace/`, ...(cursor ? { cursor } : {}) });
    await Promise.all(page.objects.map(async (object) => await snapshots.delete(object.key)));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await storage.deleteAll();
  return json({ ok: true });
}
