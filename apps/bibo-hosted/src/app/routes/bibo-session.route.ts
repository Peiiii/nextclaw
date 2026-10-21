import { json, publicError } from "../bibo-auth.utils";
import { SessionMessageCursorError } from "@nextclaw/kernel";
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
    await store.deleteSqlSource(body.id as string);
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
    const store = new CloudflareSessionStore(storage as DurableObjectStorage);
    const canonical = id ? await store.getSessionSummary(id) : null;
    if (url.searchParams.has("id") && !session && !canonical) return publicError("会话不存在或已删除。", 404);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    if (cursor && cursor.length > 2048) return publicError("历史位置不正确。", 400);
    const page = canonical && id ? await store.listSessionMessagePage({ sessionId: id, limit: 40, cursor }) : null;
    return json({ messages: page ? projectBiboConversation(page.messages) : session?.messages.slice(-40) ?? [],
      previousCursor: page?.pageInfo.hasPreviousPage ? page.pageInfo.startCursor : null,
      preparation: page?.preparation ?? null,
      session: id && (canonical || session) ? { id, title: String(canonical?.metadata?.label ?? session?.title ?? "新对话"),
        updatedAt: canonical?.updatedAt ?? session!.updatedAt } : null });
}

async function readBiboSource(url: URL, storage: SessionStore): Promise<Response> {
  const sessionId = url.searchParams.get("id"); const messageId = url.searchParams.get("message");
  const part = Number(url.searchParams.get("part") ?? "0"); const cursor = url.searchParams.get("cursor") ?? undefined;
  if (!sessionId || !messageId || !Number.isSafeInteger(part) || part < 0 || (cursor?.length ?? 0) > 32768)
    return publicError("原文位置不正确。", 400);
  const store = new CloudflareSessionStore(storage as DurableObjectStorage);
  const preparation = await store.prepareSessionHistory(sessionId);
  if (preparation && preparation.status !== "ready") return json({ preparation }, 409);
  const fragment = await store.readSessionMessagePart({ sessionId, messageId, part, cursor });
  if (!fragment) return publicError("原文不存在。", 404);
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const next = new URL(url); next.pathname = "/api/history/source";
  if (fragment.nextCursor) next.searchParams.set("cursor", fragment.nextCursor);
  else { next.searchParams.delete("cursor"); next.searchParams.set("part", String(part + 1)); }
  const hasNext = fragment.nextCursor || part + 1 < Number(url.searchParams.get("parts") ?? "1");
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>会话原文</title><body><h1>会话原文 · 第 ${part + 1} 部分</h1><p>按片段读取原始 JSON，转义字符保持原样。每次仅加载当前片段。</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(fragment.content)}</pre>${hasNext ? `<a href="${escape(next.pathname + next.search)}">${fragment.nextCursor ? "下一片段" : "下一部分"}</a>` : "<p>原文读取完毕。</p>"}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'", "x-content-type-options": "nosniff" } });
}

export async function biboSessionRoute(request: Request, url: URL, storage: SessionStore): Promise<Response> {
  const route = url.pathname;
  const sessions = await storage.get<BiboSession[]>("sessions") ?? [];
  if (route === "/sessions/delete" && request.method === "POST") return deleteBiboSession(request, storage, sessions);
  if (route === "/sessions" && request.method === "GET") return listBiboSessions(storage, sessions);
  if (route === "/sessions/rename" && request.method === "POST") return renameBiboSession(request, storage, sessions);
  if (route === "/history" || route === "/history/source") {
    try { return await (route === "/history" ? readBiboHistory(url, storage, sessions) : readBiboSource(url, storage)); }
    catch (error) {
      if (error instanceof SessionMessageCursorError) return publicError("历史已更新，请重新打开历史或原文。", 400);
      throw error;
    }
  }
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
